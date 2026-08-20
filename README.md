# SquadForge

**Project chat for student squads and hackathons.**

WhatsApp groups are great for memes — bad for shipping. SquadForge gives your team a focused project room to chat, decide with polls, manage roles, and catch up with AI when you miss messages.

![SquadForge](https://img.shields.io/badge/stack-React%20%7C%20Node%20%7C%20MongoDB%20%7C%20Redis%20%7C%20Socket.io-c8ff3d?style=flat&labelColor=0a0a0b)

> Deep dive on JWT, Redis cache invalidation, rate limits, pooling, pub/sub, and interview prep: **[BACKEND_CONCEPTS.md](./BACKEND_CONCEPTS.md)**  
> Run with Docker: **[DOCKER.md](./DOCKER.md)**

---

## Why SquadForge?

- One **project room** per hackathon / college project
- Invite friends with a **unique code** (owner accepts/rejects)
- **Realtime group chat** (Socket.io + Redis adapter / pub/sub)
- **Polls** for decisions (owner / manager only)
- **Ask AI** on a selected message range (summaries + term explanations)
- Dark, Gen Z UI — built to feel focused, not noisy

---

## Features

| Feature | Description |
|--------|-------------|
| Auth | Register / login with **JWT access + refresh** (refresh allow-list in Redis) |
| Avatars | Pick a profile avatar after signup |
| Projects | Create projects, join via invite code |
| Roles | Owner, manager, member |
| Chat | Realtime Socket.io project chat + **Find busiest stretch** (sliding window DSA) |
| Polls | Create / vote / close |
| Ask AI | Mark Start–End in chat, ask questions (Groq) |
| Infra | Redis caching, rate limiting, Mongo pooling, pub/sub |

---

## Tech stack

- **Frontend:** React (Create React App), styled-components, React Router, Axios, Socket.io-client
- **Backend:** Node.js, Express, Socket.io
- **Database:** MongoDB Atlas (Mongoose, connection pooling)
- **Redis:** cache (L1+L2), refresh tokens, rate limits, pub/sub, Socket.io adapter
- **AI:** Groq API (Gemini optional backup)

---

## Project structure

```text
SquadForge/
├── client/                 # React app (port 3000)
│   └── src/
│       ├── pages/
│       └── utils/          # api.js (JWT refresh), authStorage.js
├── server/                 # Express + Socket.io (port 5001)
│   ├── config/             # db.js (pool), redis.js
│   ├── controllers/
│   ├── middleware/         # auth, rateLimit
│   ├── pubsub/
│   ├── utils/              # jwt.js, cache.js
│   └── index.js
├── docker-compose.yml      # Redis
└── BACKEND_CONCEPTS.md     # concepts + interview prep
```

---

## Setup

### 1. Requirements

- Node.js 18+
- MongoDB Atlas connection string
- **Redis** (local or Docker)
- Groq API key ([console.groq.com/keys](https://console.groq.com/keys))

### 2. Start Redis

**Option A — Docker (recommended)**

Full stack walkthrough: **[DOCKER.md](./DOCKER.md)**

```bash
cd SquadForge
docker compose up --build -d
```

Redis only:

```bash
docker compose up -d redis
```

**Option B — Homebrew (macOS)**

```bash
brew install redis
brew services start redis
redis-cli ping   # should print PONG
```

### 3. Server

> Skip this section if you already started the full stack with `docker compose up`.

```bash
cd server
npm install
```

Create `server/.env`:

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

Optional:

```env
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=
```

Start:

```bash
npm run dev
```

You should see: `DB connected`, `Redis connected`, `Server started on port 5001`.

### 4. Client

```bash
cd client
npm install
```

Create `client/.env`:

```env
REACT_APP_LOCALHOST_KEY=squadforge-user
```

Start:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000)

> On macOS, port `5000` is often used by AirPlay — SquadForge uses **5001** by default.

---

## How to use

1. Register / login  
2. Create a project → copy invite code  
3. Friend joins with code → you accept  
4. Open project → Chat / Polls / Ask AI  
5. In chat, use **▾** on a message → Mark as Start / End → Ask AI  

---

## Scripts

**Server**

- `npm run dev` — nodemon
- `npm start` — node

**Client**

- `npm start` — development
- `npm run build` — production build

---

## Notes

- Never commit `.env` files
- Redis is required for refresh tokens, rate limits, cache, and multi-instance sockets
- Ask AI uses selected chat context; it can explain terms mentioned in that range
- If Groq/Gemini are unavailable, a local catch-up fallback is used
- Read **[BACKEND_CONCEPTS.md](./BACKEND_CONCEPTS.md)** before interviews

---

## License

MIT — built as a student / hackathon collaboration tool.
