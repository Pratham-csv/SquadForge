const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

function makeClient(label) {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
  client.on("error", (err) => console.log(`Redis(${label}) error:`, err.message));
  return client;
}

// cache + refresh tokens + rate limit
const redis = makeClient("main");
// app-level pub/sub (cache invalidate + project messages)
const redisPub = makeClient("pub");
const redisSub = makeClient("sub");
// socket.io adapter (must be dedicated connections)
const redisAdapterPub = makeClient("adapter-pub");
const redisAdapterSub = makeClient("adapter-sub");

async function connectRedis() {
  // ioredis connects automatically; wait until ready
  await Promise.all([
    new Promise((resolve) => (redis.status === "ready" ? resolve() : redis.once("ready", resolve))),
    new Promise((resolve) =>
      redisPub.status === "ready" ? resolve() : redisPub.once("ready", resolve)
    ),
    new Promise((resolve) =>
      redisSub.status === "ready" ? resolve() : redisSub.once("ready", resolve)
    ),
    new Promise((resolve) =>
      redisAdapterPub.status === "ready"
        ? resolve()
        : redisAdapterPub.once("ready", resolve)
    ),
    new Promise((resolve) =>
      redisAdapterSub.status === "ready"
        ? resolve()
        : redisAdapterSub.once("ready", resolve)
    ),
  ]);
  console.log("Redis connected");
}

module.exports = {
  redis,
  redisPub,
  redisSub,
  redisAdapterPub,
  redisAdapterSub,
  connectRedis,
};
