const {
  createProject,
  getMyProjects,
  requestJoin,
  getPendingRequests,
  handleJoinRequest,
  getProject,
  promoteMember,
} = require("../controllers/projectController");
const { requireAuth } = require("../middleware/auth");

const router = require("express").Router();

router.use(requireAuth);

router.post("/create", createProject);
router.get("/my/:userId", getMyProjects);
router.post("/join", requestJoin);
router.get("/requests/:projectId/:userId", getPendingRequests);
router.post("/handle-request", handleJoinRequest);
router.post("/promote", promoteMember);
router.get("/:projectId/:userId", getProject);

module.exports = router;
