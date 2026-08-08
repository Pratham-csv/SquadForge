const {
  createProject,
  getMyProjects,
  requestJoin,
  getPendingRequests,
  handleJoinRequest,
  getProject,
} = require("../controllers/projectController");

const router = require("express").Router();

router.post("/create", createProject);
router.get("/my/:userId", getMyProjects);
router.post("/join", requestJoin);
router.get("/requests/:projectId/:userId", getPendingRequests);
router.post("/handle-request", handleJoinRequest);
router.get("/:projectId/:userId", getProject);

module.exports = router;
