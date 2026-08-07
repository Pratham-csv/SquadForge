const Project = require("../models/projectModel");

function makeInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SF-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

module.exports.createProject = async (req, res, next) => {
  try {
    const { name, description, userId } = req.body;

    if (!name || !userId) {
      return res.json({ status: false, msg: "Name and userId are required" });
    }

    let inviteCode = makeInviteCode();
    let exists = await Project.findOne({ inviteCode });
    while (exists) {
      inviteCode = makeInviteCode();
      exists = await Project.findOne({ inviteCode });
    }

    const project = await Project.create({
      name,
      description: description || "",
      inviteCode,
      owner: userId,
      members: [{ user: userId, role: "owner" }],
      joinRequests: [],
    });

    return res.json({ status: true, project });
  } catch (err) {
    next(err);
  }
};

module.exports.getMyProjects = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const projects = await Project.find({
      "members.user": userId,
    }).sort({ updatedAt: -1 });

    return res.json({ status: true, projects });
  } catch (err) {
    next(err);
  }
};

module.exports.requestJoin = async (req, res, next) => {
  try {
    const { inviteCode, userId } = req.body;

    const project = await Project.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!project) {
      return res.json({ status: false, msg: "Invalid invite code" });
    }

    const alreadyMember = project.members.some(
      (m) => m.user.toString() === userId
    );
    if (alreadyMember) {
      return res.json({ status: false, msg: "You are already in this project" });
    }

    const alreadyRequested = project.joinRequests.some(
      (r) => r.user.toString() === userId && r.status === "pending"
    );
    if (alreadyRequested) {
      return res.json({ status: false, msg: "Join request already sent" });
    }

    project.joinRequests.push({ user: userId, status: "pending" });
    await project.save();

    return res.json({ status: true, msg: "Join request sent" });
  } catch (err) {
    next(err);
  }
};

module.exports.getPendingRequests = async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;

    const project = await Project.findById(projectId).populate(
      "joinRequests.user",
      "username email"
    );

    if (!project) {
      return res.json({ status: false, msg: "Project not found" });
    }

    if (project.owner.toString() !== userId) {
      return res.json({ status: false, msg: "Only owner can see requests" });
    }

    const pending = project.joinRequests.filter((r) => r.status === "pending");
    return res.json({ status: true, requests: pending, projectName: project.name });
  } catch (err) {
    next(err);
  }
};

module.exports.handleJoinRequest = async (req, res, next) => {
  try {
    const { projectId, requestId, userId, action } = req.body;

    if (action !== "accept" && action !== "reject") {
      return res.json({ status: false, msg: "Action must be accept or reject" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.json({ status: false, msg: "Project not found" });
    }

    if (project.owner.toString() !== userId) {
      return res.json({ status: false, msg: "Only owner can handle requests" });
    }

    const request = project.joinRequests.id(requestId);
    if (!request || request.status !== "pending") {
      return res.json({ status: false, msg: "Request not found" });
    }

    if (action === "accept") {
      request.status = "accepted";
      project.members.push({ user: request.user, role: "member" });
    } else {
      request.status = "rejected";
    }

    await project.save();
    return res.json({ status: true, msg: `Request ${action}ed` });
  } catch (err) {
    next(err);
  }
};