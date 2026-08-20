const { askAboutChat } = require("../controllers/aiController");
const { requireAuth } = require("../middleware/auth");
const { aiLimiter } = require("../middleware/rateLimit");

const router = require("express").Router();

router.post("/ask", requireAuth, aiLimiter, askAboutChat);

module.exports = router;
