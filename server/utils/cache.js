const { redis, redisPub, redisSub } = require("../config/redis");

const INVALIDATE_CHANNEL = "squadforge:cache:invalidate";

/**
 * Two-level cache (cache-aside):
 *   L1 = in-process Map (fastest, per Node instance)
 *   L2 = Redis (shared across instances)
 *
 * Read path: L1 → L2 → MongoDB → fill L2 + L1
 * Write path: update Mongo → delete L1+L2 keys → PUBLISH so other
 *             instances drop their L1 copies
 *
 * Why TTL + explicit invalidation?
 * - Explicit invalidation → lists stay fresh after create/message/poll
 * - TTL → safety net if a key is forgotten (eventual consistency)
 *
 * Tradeoffs:
 * - Short TTL → more DB hits, fresher data
 * - Long TTL → fewer DB hits, higher stale risk if invalidate misses
 * - L1 alone → wrong across multiple servers (stale) → need pub/sub
 * - Redis alone → shared, but slower than local memory
 * - Write-through / write-behind → more complex; cache-aside is simpler
 *   and enough for this app's read-heavy project/poll lists
 */

const l1 = new Map();

async function cacheGet(key) {
  if (l1.has(key)) {
    return l1.get(key);
  }

  const raw = await redis.get(key);
  if (!raw) return null;

  try {
    const value = JSON.parse(raw);
    l1.set(key, value);
    return value;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 60) {
  l1.set(key, value);
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  // Drop L1 after TTL so we don't keep forever-stale local copies
  setTimeout(() => {
    l1.delete(key);
  }, ttlSeconds * 1000).unref?.();
}

async function cacheDel(...keys) {
  const flat = keys.flat().filter(Boolean);
  if (!flat.length) return;
  for (const key of flat) {
    l1.delete(key);
  }
  await redis.del(...flat);
}

async function publishInvalidate(keys) {
  const payload = JSON.stringify({ keys: keys.flat().filter(Boolean) });
  await redisPub.publish(INVALIDATE_CHANNEL, payload);
}

/** Delete locally + Redis, then tell other Node processes to drop L1 */
async function invalidate(keys) {
  await cacheDel(keys);
  await publishInvalidate(keys);
}

function listenForInvalidation() {
  redisSub.subscribe(INVALIDATE_CHANNEL, (err) => {
    if (err) console.log("Cache invalidate subscribe error:", err.message);
    else console.log("Subscribed to cache invalidation channel");
  });

  redisSub.on("message", (channel, message) => {
    if (channel !== INVALIDATE_CHANNEL) return;
    try {
      const { keys } = JSON.parse(message);
      // Other instances already deleted Redis keys; we only clear L1
      for (const key of (keys || []).filter(Boolean)) {
        l1.delete(key);
      }
    } catch (err) {
      console.log("Invalidate message error:", err.message);
    }
  });
}

const keys = {
  myProjects: (userId) => `cache:projects:my:${userId}`,
  project: (projectId) => `cache:project:${projectId}`,
  polls: (projectId) => `cache:polls:${projectId}`,
  messages: (projectId) => `cache:messages:${projectId}`,
};

module.exports = {
  cacheGet,
  cacheSet,
  cacheDel,
  invalidate,
  listenForInvalidation,
  keys,
  INVALIDATE_CHANNEL,
};
