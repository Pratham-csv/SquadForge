const {
  createPoll,
  getPolls,
  votePoll,
  closePoll,
} = require("../controllers/pollController");
const { requireAuth } = require("../middleware/auth");

const router = require("express").Router();

router.use(requireAuth);

router.post("/create", createPoll);
router.get("/:projectId/:userId", getPolls);
router.post("/vote", votePoll);
router.post("/close", closePoll);

module.exports = router;
