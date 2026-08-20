const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { redis } = require("../config/redis");

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret-change-me";
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "dev-refresh-secret-change-me";

const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_EXPIRES_SEC = Number(process.env.JWT_REFRESH_EXPIRES_SEC || 60 * 60 * 24 * 7); // 7 days

function signAccessToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      username: user.username,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

async function createRefreshToken(userId) {
  const jti = crypto.randomBytes(16).toString("hex");
  const token = jwt.sign({ id: userId, jti }, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_SEC,
  });

  // Store in Redis so we can revoke (logout / rotate)
  await redis.set(`refresh:${userId}:${jti}`, "1", "EX", REFRESH_EXPIRES_SEC);
  return token;
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

async function isRefreshTokenValid(userId, jti) {
  const exists = await redis.get(`refresh:${userId}:${jti}`);
  return Boolean(exists);
}

async function revokeRefreshToken(userId, jti) {
  await redis.del(`refresh:${userId}:${jti}`);
}

async function revokeAllRefreshTokens(userId) {
  const keys = await redis.keys(`refresh:${userId}:*`);
  if (keys.length) {
    await redis.del(...keys);
  }
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken(user._id.toString());
  return { accessToken, refreshToken };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  isRefreshTokenValid,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  issueTokenPair,
};
