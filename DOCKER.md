# SquadForge — Docker walkthrough

Run the whole app (Redis + Express API + React) with Docker Compose.

---

## What you get

| Service | Container | Host URL | Role |
|---------|-----------|----------|------|
| Redis | `squadforge-redis` | *internal only* | Cache, JWT refresh, rate limits, pub/sub |
| API | `squadforge-server` | [http://localhost:5001](http://localhost:5001) | Express + Socket.io |
| Client | `squadforge-client` | [http://localhost:3000](http://localhost:3000) | React build served by nginx |

Redis is **not** published to your Mac’s port `6379` (avoids clashes with Homebrew Redis). The API still reaches it as `redis://redis:6379` inside Docker.

```text
Browser (you)
   │
   ├─ http://localhost:3000  →  client container (nginx)
   └─ http://localhost:5001  →  server container
                                   │
                                   ├─ redis://redis:6379  (Docker network)
                                   └─ MongoDB Atlas (from server/.env)
```

**Important:** Your browser still calls `localhost:5001` for the API. Only containers talk to each other by service name (`redis`, `server`).

---

## Prerequisites

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and **running** (whale icon in the menu bar)
2. `server/.env` filled in (Mongo, JWT, Groq, etc.) — see `server/.env.example`
3. Atlas network access allows your IP (or `0.0.0.0/0` for demos)

Check Docker:

```bash
docker --version
docker compose version
```

---

## One-time: env file

Make sure `SquadForge/server/.env` exists with at least:

```env
PORT=5001
MONGO_URL=your_mongodb_atlas_uri
ORIGIN=http://localhost:3000
GROQ_API_KEY=your_groq_api_key

REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES_SEC=604800
MONGO_MAX_POOL=10
MONGO_MIN_POOL=2
```

Compose **overrides** `REDIS_URL` to `redis://redis:6379` inside the server container. Keeping `127.0.0.1` in `.env` is fine for local (non-Docker) runs.

Never commit `.env`.

---

## Start everything

From the **SquadForge** folder (not Quirk-Chat root):

```bash
cd /Users/prathamkala/Documents/Quirk-Chat/SquadForge
docker compose up --build
```

First build takes a few minutes (npm install + React build).

**Detached mode** (runs in background):

```bash
docker compose up --build -d
```

When healthy:

1. Open [http://localhost:3000](http://localhost:3000)
2. API check: [http://localhost:5001](http://localhost:5001) → JSON with `jwt-access-refresh`, `redis-cache`, etc.
3. **Log in / register again** (JWT tokens are new after this stack)

---

## Useful commands

```bash
# Status
docker compose ps

# Logs (all)
docker compose logs -f

# Logs (one service)
docker compose logs -f server
docker compose logs -f client
docker compose logs -f redis

# Stop (keep containers)
docker compose stop

# Stop + remove containers (volumes for redis data are none by default)
docker compose down

# Rebuild after code changes
docker compose up --build -d

# Shell into API container
docker compose exec server sh

# Ping Redis inside the stack
docker compose exec redis redis-cli ping
```

---

## Files involved

```text
SquadForge/
├── docker-compose.yml      # redis + server + client
├── DOCKER.md               # this file
├── server/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── .env                # secrets (not in git)
└── client/
    ├── Dockerfile          # multi-stage: build → nginx
    ├── nginx.conf          # SPA routing
    └── .dockerignore
```

---

## How the Dockerfiles work

### Server (`server/Dockerfile`)

1. `node:20-bookworm-slim` base
2. Install build tools (needed for native `bcrypt`)
3. `npm install --omit=dev`
4. `node index.js` on port `5001`

### Client (`client/Dockerfile`)

1. **Build stage:** `npm run build` with `REACT_APP_API_URL=http://localhost:5001`
2. **Run stage:** copy `build/` into nginx; serve on port 80 (mapped to host `3000`)

CRA embeds `REACT_APP_*` at **build** time. Changing the API URL means rebuild:

```bash
docker compose build client --no-cache
docker compose up -d client
```

---

## Redis only (local Node outside Docker)

If you want to keep coding with `npm run dev` on the host, but Redis in Docker:

```bash
docker compose up -d redis
```

Then in other terminals:

```bash
cd server && npm run dev
cd client && npm start
```

Use `REDIS_URL=redis://127.0.0.1:6379` in `server/.env` for that mode.

---

## Common problems

| Problem | Fix |
|---------|-----|
| `Cannot connect to Docker daemon` | Start Docker Desktop, wait until it says running |
| Port 3000 / 5001 in use | Stop local `npm` servers, or change ports in `docker-compose.yml` |
| `6379: bind: address already in use` | Compose no longer maps Redis to the host. Run `docker compose up -d` again. (Old Homebrew Redis on 6379 can keep running; Docker Redis is separate.) |
| Server exits: Redis | Wait for healthcheck; `docker compose logs redis` |
| Server exits: Mongo | Check `MONGO_URL` and Atlas IP allowlist |
| Blank page / API 401 | Hard refresh; clear localStorage; register/login again |
| Client can’t call API | Confirm [http://localhost:5001](http://localhost:5001) works; rebuild client if you changed `REACT_APP_API_URL` |
| Stale UI after code edit | `docker compose up --build -d` |

Conflict tip: if you previously started Redis from Homebrew or `.tools/redis-server`, stop it before Compose binds `6379`:

```bash
brew services stop redis
# or kill the local redis-server process
```

---

## Dev vs Docker

| Mode | When to use |
|------|-------------|
| `npm run dev` + `npm start` | Day-to-day coding (fast reload) |
| `docker compose up` | Demo, interview “how I deploy”, consistent env |
| `docker compose up -d redis` only | Hybrid: Redis in Docker, code on host |

---

## Interview one-liner

“I containerized SquadForge with Compose: Redis for cache/rate-limit/pub-sub/refresh tokens, a Node API image, and a multi-stage CRA build served by nginx. The browser hits published host ports; inside the network the API reaches Redis by service DNS (`redis://redis:6379`).”

---

## Quick checklist

- [ ] Docker Desktop running  
- [ ] `server/.env` present  
- [ ] `cd SquadForge && docker compose up --build -d`  
- [ ] [http://localhost:3000](http://localhost:3000) loads  
- [ ] [http://localhost:5001](http://localhost:5001) returns JSON  
- [ ] Register / login works  
- [ ] Create project + chat works  

Done — you’re running the full stack in Docker.
