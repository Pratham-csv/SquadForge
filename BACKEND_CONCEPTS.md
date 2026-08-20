# SquadForge — Backend concepts & interview prep

This document explains the Redis/JWT production patterns added to SquadForge, the tradeoffs we chose, challenges faced, and design decisions (why MongoDB / JS, not SQL / Python).

---

## Architecture snapshot

```text
React client
  │  Authorization: Bearer <accessToken>
  │  refresh on 401 → /api/auth/refresh
  ▼
Express (one or many instances)
  ├── JWT access (15m) + refresh (7d, Redis allow-list)
  ├── Rate limit (Redis store — shared across instances)
  ├── Cache L1 (in-memory) + L2 (Redis) + MongoDB
  ├── MongoDB pool (Mongoose maxPoolSize / minPoolSize)
  └── Socket.io + Redis adapter + app Pub/Sub for chat
         ▲
         └── Redis (cache, rate limit, refresh tokens, pub/sub)
```

---

## 1. JWT access + refresh tokens

### What
- **Access token** — short-lived JWT (default 15 minutes). Sent on every API call as `Authorization: Bearer ...`.
- **Refresh token** — longer-lived JWT (default 7 days). Stored in Redis as `refresh:{userId}:{jti}` so we can **revoke** it.

### Flow
1. Login/register → server returns `{ accessToken, refreshToken, user }`
2. Client stores both; axios attaches access token
3. When access expires → client calls `/api/auth/refresh` with refresh token
4. Server: verify JWT → check Redis allow-list → **rotate** (delete old jti, issue new pair)
5. Logout → delete that refresh jti from Redis

### Why Redis for refresh?
A signed JWT alone cannot be revoked until it expires. Putting the refresh `jti` in Redis gives logout / steal-response: delete the key → token dies immediately.

### Tradeoffs
| Choice | Pro | Con |
|--------|-----|-----|
| Short access + refresh | Stolen access dies fast | More refresh traffic |
| Refresh in Redis | Revocable, rotatable | Redis becomes auth dependency |
| Rotate on every refresh | Limits replay of stolen refresh | Concurrent tabs need careful UX |
| Store userId in body (old) | Simple | Spoofable — we moved identity to JWT |

**Interview line:** “Stateless access JWT for speed; stateful refresh allow-list in Redis for revocation.”

---

## 2. Rate limiting

### What
`express-rate-limit` + `rate-limit-redis` so counters live in Redis, not in one Node process’s memory.

### Limits (defaults)
- Auth (`/login`, `/register`, `/refresh`): 20 / 15 min
- General API: 120 / min
- AI: 10 / min (expensive upstream)

### Tradeoffs
| Approach | Pro | Con |
|----------|-----|-----|
| In-memory limiter | Zero infra | Wrong under multiple servers (each has own counter) |
| Redis store | Shared, correct for scale-out | Needs Redis up |
| Too strict | Safer | Blocks real users / demos |
| Too loose | Nice UX | Brute force / cost abuse |

**Interview line:** “Rate limits must be global when you horizontal-scale — Redis is the shared counter.”

---

## 3. Caching + validation / invalidation

### Pattern: cache-aside (lazy loading) with L1 + L2

```text
GET projects
  1. Check L1 (Map in this Node process)
  2. Else check L2 (Redis)
  3. Else query Mongo → SET Redis + L1 with TTL
```

### Invalidation strategy (what we use)

On **writes** (create project, join accept, new message, poll vote/close):

1. Update MongoDB (source of truth)
2. `DEL` related Redis keys + clear local L1
3. `PUBLISH squadforge:cache:invalidate` so **other** Node processes drop their L1

Plus **TTL** on every cache entry (e.g. projects 60s, messages 20s) as a safety net.

### Why not only TTL?
If someone creates a project, waiting 60s for the list to update is bad UX. Explicit invalidation fixes that key immediately.

### Why not only invalidation?
If you forget to invalidate one code path, TTL eventually heals stale data (eventual consistency).

### Why L1 + Redis + pub/sub?
- Redis alone is shared → `DEL` is enough for L2
- L1 is per process → without pub/sub, instance B serves stale L1 after instance A wrote
- Pub/sub exists so L1 stays coherent across instances

### Alternatives we considered

| Strategy | When it fits | Why not primary here |
|----------|--------------|----------------------|
| Write-through | Always keep cache = DB on write | Extra write latency; more code |
| Write-behind | Ultra high write throughput | Risk of data loss; overkill |
| Cache-aside + TTL only | Rarely changing data | Stale lists after joins/chat |
| Full page CDN cache | Public marketing pages | Private per-user data |

**Interview line:** “Cache-aside with short TTL + explicit invalidation; L1 for speed, Redis for share, pub/sub to bust L1 across nodes.”

---

## 4. Database pooling

### What
Mongoose/Mongo driver keeps a **pool** of TCP connections:

```js
mongoose.connect(uri, {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
});
```

### Why
Opening a new DB connection per request is slow (TLS + auth). A pool reuses warm sockets.

### Tradeoffs
| Setting | Too low | Too high |
|---------|---------|----------|
| maxPoolSize | Queueing / timeouts under load | Exhaust Atlas connection limit |
| minPoolSize | Cold start latency | Idle sockets burn resources |

**Interview line:** “Pooling amortizes connection cost; size the pool to traffic and Atlas tier limits.”

---

## 5. Pub/Sub

### Two uses in SquadForge

1. **App channel** `squadforge:project:message` — after HTTP saves a chat message, publish so every server instance emits Socket.io `receive-project-msg` to the project room.
2. **Cache channel** `squadforge:cache:invalidate` — drop L1 on other instances.
3. **Socket.io Redis adapter** — built-in pub/sub so rooms work across multiple Node processes.

### Why not only Socket.io emit on one process?
With two servers behind a load balancer, user A on server 1 and user B on server 2 would not share rooms unless you use the Redis adapter (and/or your own pub/sub).

### Tradeoffs
| Approach | Pro | Con |
|----------|-----|-----|
| Single process Socket.io | Simple | Doesn’t scale horizontally |
| Redis adapter | Multi-instance rooms | Extra Redis dependency |
| Kafka / RabbitMQ | Durable queues, replay | Heavier; chat fan-out doesn’t need durability |

**Interview line:** “Redis pub/sub for ephemeral fan-out; Socket.io adapter so rooms survive multi-instance deploy.”

---

## 6. DSA highlight: busiest chat stretch (sliding window)

**Visible demo:** Chat tab → **Find busiest stretch** → messages in the densest time window glow + badge shows complexity.

**Algorithm:** two pointers over messages sorted by `createdAt`. Expand `right`, shrink `left` while `time[right] - time[left] > windowMs`, track max count.

**Complexity:** O(n) time, O(1) extra space (vs O(n²) brute force over all pairs).

**Code:** `server/algorithms/busiestWindow.js` · API `GET /api/messages/busiest/:projectId?windowMinutes=30`

**Interview line:** “I used a sliding window to find the busiest stretch of chat so the squad (and Ask AI) can jump to where the discussion was densest.”

---

## Challenges faced (interview stories)

Use STAR (Situation → Task → Action → Result). Keep answers concrete.

### 1. “Auth was spoofable”
- **S:** Early API trusted `userId` from the request body.
- **T:** Stop clients from acting as another user.
- **A:** JWT access tokens + `requireAuth`; identity from `req.user.id` only.
- **R:** Authorization is server-derived; body `userId` removed from sensitive writes.

### 2. “Access tokens vs logout”
- **S:** Pure JWT cannot be revoked early.
- **A:** Short access TTL + refresh allow-list in Redis; logout deletes `jti`.
- **R:** Logout actually ends the session; stolen refresh can be rotated away.

### 3. “Stale project lists after join”
- **S:** Caching my-projects made joins look delayed.
- **A:** Invalidate `cache:projects:my:{userId}` (and related keys) on create/accept; keep short TTL.
- **R:** Fresh UI without hitting Mongo on every Home load.

### 4. “Duplicate chat messages”
- **S:** Client optimistic append + socket broadcast + pub/sub emit = duplicates.
- **A:** Dedupe by message `_id` on the client; rely on HTTP save + pub/sub for cross-instance delivery.
- **R:** One bubble per message even with multi-path delivery.

### 5. “Rate limit wrong under two servers”
- **S:** In-memory limiter reset per process.
- **A:** Redis store for counters.
- **R:** Global limits for brute-force and AI cost control.

### 6. “AI quota / provider reliability”
- **S:** Gemini free tier `limit: 0`; needed demos to work.
- **A:** Groq primary + local fallback for catch-up text.
- **R:** Feature still demoable when providers fail.

### 7. “Port 5000 on macOS”
- **S:** AirPlay Receiver grabbed 5000.
- **A:** Default API port `5001`.
- **R:** Local dev just works.

---

## Key design decisions

### Why MongoDB (not SQL / Postgres)?
- Document model matches nested project data (`members[]`, `joinRequests[]`) without heavy joins.
- Fast iteration for a student/hackathon MVP — schema evolves with the features.
- Atlas free tier is easy for demos.
- **Tradeoff:** weaker multi-document transactions / relational reporting; for chat + projects this was acceptable. Would revisit SQL if we needed complex analytics or strong relational constraints.

### Why JavaScript/Node (not Python)?
- One language across React + Express → faster learning and hiring story for fullstack.
- Socket.io ecosystem is mature in Node for realtime chat.
- Non-blocking I/O fits many concurrent socket + HTTP connections.
- **Tradeoff:** Python (FastAPI/Django) can be great for ML-heavy backends; our AI is an HTTP call to Groq, so Node stayed simpler.

### Why Redis for all of this?
- One infra piece covers: cache, rate limits, refresh sessions, pub/sub, Socket.io adapter.
- **Tradeoff:** Redis becomes a critical dependency — document it, health-check it, and know what fails if it’s down (auth refresh, cache, limits, multi-instance chat).

### Why CRA + styled-components?
- Familiar CRA tooling for the learning path; CSS-in-JS colocates the dark Gen Z theme without a separate design-system setup.

### Why project rooms only (no 1:1 DMs)?
- Product focus: replace noisy WhatsApp *project* groups, not become another Messenger. Scope control for a portfolio-quality MVP.

---

## File map (where to point in interviews)

| Concept | Files |
|---------|--------|
| JWT issue / refresh / revoke | `server/utils/jwt.js`, `server/controllers/userController.js` |
| Auth middleware | `server/middleware/auth.js` |
| Rate limiting | `server/middleware/rateLimit.js` |
| Cache L1/L2 + invalidate | `server/utils/cache.js` |
| Pub/Sub messages | `server/pubsub/index.js` |
| Mongo pool | `server/config/db.js` |
| Redis clients | `server/config/redis.js` |
| Wire-up | `server/index.js` |
| Client token refresh | `client/src/utils/api.js`, `authStorage.js` |

---

## Quick verbal definitions

- **JWT** — signed claims; server trusts signature without a DB lookup (access).
- **Refresh token** — long-lived credential used only to mint new access tokens; we store an allow-list entry in Redis.
- **Rate limiting** — cap requests per IP/user per window to stop abuse.
- **Cache-aside** — app reads cache first; on miss loads DB and fills cache.
- **Invalidation** — delete cache keys after writes so readers don’t see stale data.
- **Connection pooling** — reuse DB sockets instead of connect-per-request.
- **Pub/Sub** — publish an event; all subscribers get a copy (fan-out). Good for ephemeral realtime, not durable queues.
