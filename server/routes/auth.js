const {
  register,
  login,
  setAvatar,
  refresh,
  logout,
} = require("../controllers/userController");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");

const router = require("express").Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", logout);
router.post("/setavatar/:id", requireAuth, setAvatar);

module.exports = router;
