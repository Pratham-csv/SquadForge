const { getMessages, addMessage } = require("../controllers/messageController");
const router = require("express").Router();

router.get("/:projectId/:userId", getMessages);
router.post("/add", addMessage);

module.exports = router;
