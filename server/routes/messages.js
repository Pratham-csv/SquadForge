const {
  getMessages,
  addMessage,
  getBusiestWindow,
} = require("../controllers/messageController");
const { requireAuth } = require("../middleware/auth");
const router = require("express").Router();

router.use(requireAuth);

// Static path before /:projectId params
router.get("/busiest/:projectId", getBusiestWindow);
router.get("/:projectId/:userId", getMessages);
router.post("/add", addMessage);

module.exports = router;
