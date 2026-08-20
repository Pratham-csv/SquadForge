const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { redis } = require("../config/redis");

/**
 * Rate limiting with Redis store so limits are shared across
 * multiple Node server instances (not just in-memory per process).
 */

function createLimiter({ windowMs, max, prefix, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: false, msg: message },
    store: new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix,
    }),
  });
}

// Login/register: stop brute force
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  prefix: "rl:auth:",
  message: "Too many auth attempts. Try again in 15 minutes.",
});

// General API
const apiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 120,
  prefix: "rl:api:",
  message: "Too many requests. Slow down.",
});

// AI is expensive — stricter
const aiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  prefix: "rl:ai:",
  message: "AI rate limit reached. Try again shortly.",
});

module.exports = { authLimiter, apiLimiter, aiLimiter };
