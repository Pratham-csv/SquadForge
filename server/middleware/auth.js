const {
  verifyAccessToken,
} = require("../utils/jwt");

/**
 * Protects routes. Expects: Authorization: Bearer <accessToken>
 * Sets req.user = { id, username }
 */
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({ status: false, msg: "Missing access token" });
    }

    const payload = verifyAccessToken(token);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ status: false, msg: "Invalid or expired access token" });
  }
}

/**
 * Ensures body/params userId matches the logged-in user.
 * Prevents "pass someone else's userId" attacks.
 */
function requireSelfUserId(req, res, next) {
  const userId = req.body.userId || req.params.userId;
  if (!userId) {
    return res.status(400).json({ status: false, msg: "userId is required" });
  }
  if (userId !== req.user.id) {
    return res.status(403).json({ status: false, msg: "Forbidden: user mismatch" });
  }
  next();
}

module.exports = { requireAuth, requireSelfUserId };
