const Poll = require("../models/pollModel");
const Project = require("../models/projectModel");
const { cacheGet, cacheSet, invalidate, keys } = require("../utils/cache");

async function getMemberRole(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) return null;

  const member = project.members.find((m) => m.user.toString() === userId);
  if (!member) return null;

  return member.role;
}

function canManagePolls(role) {
  return role === "owner" || role === "manager";
}

module.exports.createPoll = async (req, res, next) => {
  try {
    const { projectId, question, options } = req.body;
    const userId = req.user.id;

    if (!question || !options || options.length < 2) {
      return res.json({
        status: false,
        msg: "Question and at least 2 options are required",
      });
    }

    const role = await getMemberRole(projectId, userId);
    if (!role) {
      return res.json({ status: false, msg: "Not a project member" });
    }
    if (!canManagePolls(role)) {
      return res.json({
        status: false,
        msg: "Only owner/manager can create polls",
      });
    }

    const cleanOptions = options
      .map((text) => String(text).trim())
      .filter((text) => text.length > 0)
      .slice(0, 6)
      .map((text) => ({ text, votes: [] }));

    if (cleanOptions.length < 2) {
      return res.json({ status: false, msg: "Need at least 2 valid options" });
    }

    const poll = await Poll.create({
      project: projectId,
      createdBy: userId,
      question: question.trim(),
      options: cleanOptions,
      isOpen: true,
    });

    await invalidate([keys.polls(projectId)]);

    return res.json({ status: true, poll });
  } catch (err) {
    next(err);
  }
};

module.exports.getPolls = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const role = await getMemberRole(projectId, userId);
    if (!role) {
      return res.json({ status: false, msg: "Not a project member" });
    }

    const cacheKey = keys.polls(projectId);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({
        status: true,
        polls: cached,
        myRole: role,
        cached: true,
      });
    }

    const polls = await Poll.find({ project: projectId })
      .populate("createdBy", "username")
      .sort({ createdAt: -1 });

    await cacheSet(cacheKey, polls, 30);
    return res.json({ status: true, polls, myRole: role, cached: false });
  } catch (err) {
    next(err);
  }
};

module.exports.votePoll = async (req, res, next) => {
  try {
    const { pollId, optionId } = req.body;
    const userId = req.user.id;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.json({ status: false, msg: "Poll not found" });
    }
    if (!poll.isOpen) {
      return res.json({ status: false, msg: "Poll is closed" });
    }

    const projectId = poll.project.toString();
    const role = await getMemberRole(projectId, userId);
    if (!role) {
      return res.json({ status: false, msg: "Not a project member" });
    }

    const alreadyVoted = poll.options.some((opt) =>
      opt.votes.some((v) => v.toString() === userId)
    );
    if (alreadyVoted) {
      return res.json({ status: false, msg: "You already voted" });
    }

    const option = poll.options.id(optionId);
    if (!option) {
      return res.json({ status: false, msg: "Option not found" });
    }

    option.votes.push(userId);
    await poll.save();

    const updated = await Poll.findById(pollId).populate(
      "createdBy",
      "username"
    );

    await invalidate([keys.polls(projectId)]);

    return res.json({ status: true, poll: updated });
  } catch (err) {
    next(err);
  }
};

module.exports.closePoll = async (req, res, next) => {
  try {
    const { pollId } = req.body;
    const userId = req.user.id;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.json({ status: false, msg: "Poll not found" });
    }

    const projectId = poll.project.toString();
    const role = await getMemberRole(projectId, userId);
    if (!canManagePolls(role)) {
      return res.json({
        status: false,
        msg: "Only owner/manager can close polls",
      });
    }

    poll.isOpen = false;
    await poll.save();

    const updated = await Poll.findById(pollId).populate(
      "createdBy",
      "username"
    );

    await invalidate([keys.polls(projectId)]);

    return res.json({ status: true, poll: updated });
  } catch (err) {
    next(err);
  }
};
