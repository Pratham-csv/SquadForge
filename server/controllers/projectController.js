const Project = require("../models/projectModel");
const { cacheGet, cacheSet, invalidate, keys } = require("../utils/cache");

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
    const { name, description } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.json({ status: false, msg: "Name is required" });
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

    await invalidate([keys.myProjects(userId)]);

    return res.json({ status: true, project });
  } catch (err) {
    next(err);
  }
};

module.exports.getMyProjects = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const cacheKey = keys.myProjects(userId);

    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ status: true, projects: cached, cached: true });
    }

    const projects = await Project.find({
      "members.user": userId,
    }).sort({ updatedAt: -1 });

    await cacheSet(cacheKey, projects, 60);
    return res.json({ status: true, projects, cached: false });
  } catch (err) {
    next(err);
  }
};

module.exports.requestJoin = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;
    const userId = req.user.id;

    const project = await Project.findOne({
      inviteCode: inviteCode.toUpperCase(),
    });
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

    await invalidate([keys.project(project._id.toString())]);

    return res.json({ status: true, msg: "Join request sent" });
  } catch (err) {
    next(err);
  }
};

module.exports.getPendingRequests = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

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
    return res.json({
      status: true,
      requests: pending,
      projectName: project.name,
    });
  } catch (err) {
    next(err);
  }
};

module.exports.handleJoinRequest = async (req, res, next) => {
  try {
    const { projectId, requestId, action } = req.body;
    const userId = req.user.id;

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

    const memberUserId = request.user.toString();

    if (action === "accept") {
      request.status = "accepted";
      project.members.push({ user: request.user, role: "member" });
    } else {
      request.status = "rejected";
    }

    await project.save();

    await invalidate([
      keys.project(projectId),
      keys.myProjects(userId),
      keys.myProjects(memberUserId),
    ]);

    return res.json({ status: true, msg: `Request ${action}ed` });
  } catch (err) {
    next(err);
  }
};

module.exports.getProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const cacheKey = keys.project(projectId);

    const cached = await cacheGet(cacheKey);
    if (cached) {
      const allowed = cached.members.some(
        (m) => (m.user._id || m.user).toString() === userId
      );
      if (!allowed) {
        return res.json({ status: false, msg: "Not a project member" });
      }
      return res.json({ status: true, project: cached, cached: true });
    }

    const project = await Project.findById(projectId).populate(
      "members.user",
      "username email"
    );

    if (!project) {
      return res.json({ status: false, msg: "Project not found" });
    }

    const allowed = project.members.some(
      (m) => m.user._id.toString() === userId
    );
    if (!allowed) {
      return res.json({ status: false, msg: "Not a project member" });
    }

    await cacheSet(cacheKey, project, 60);
    return res.json({ status: true, project, cached: false });
  } catch (err) {
    next(err);
  }
};

module.exports.promoteMember = async (req, res, next) => {
  try {
    const { projectId, memberId } = req.body;
    const userId = req.user.id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.json({ status: false, msg: "Project not found" });
    }

    if (project.owner.toString() !== userId) {
      return res.json({ status: false, msg: "Only owner can promote members" });
    }

    const member = project.members.find((m) => m.user.toString() === memberId);
    if (!member) {
      return res.json({ status: false, msg: "Member not found" });
    }

    if (member.role === "owner") {
      return res.json({ status: false, msg: "Owner is already top role" });
    }

    member.role = "manager";
    await project.save();

    const updated = await Project.findById(projectId).populate(
      "members.user",
      "username email"
    );

    await invalidate([keys.project(projectId), keys.polls(projectId)]);

    return res.json({
      status: true,
      project: updated,
      msg: "Member promoted to manager",
    });
  } catch (err) {
    next(err);
  }
};
