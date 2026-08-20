const Message = require("../models/messageModel");
const Project = require("../models/projectModel");
const { cacheGet, cacheSet, invalidate, keys } = require("../utils/cache");
const { publishProjectMessage } = require("../pubsub");
const { findBusiestWindow } = require("../algorithms/busiestWindow");

async function isMember(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) return false;
  return project.members.some((m) => m.user.toString() === userId);
}

module.exports.getMessages = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const allowed = await isMember(projectId, userId);
    if (!allowed) {
      return res.json({ status: false, msg: "Not a project member" });
    }

    const cacheKey = keys.messages(projectId);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ status: true, messages: cached, cached: true });
    }

    const messages = await Message.find({ project: projectId })
      .populate("sender", "username avatarImage")
      .sort({ createdAt: 1 });

    await cacheSet(cacheKey, messages, 20);
    return res.json({ status: true, messages, cached: false });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/messages/busiest/:projectId?windowMinutes=30
 * Runs sliding-window DSA on sorted chat timestamps.
 */
module.exports.getBusiestWindow = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const windowMinutes = Number(req.query.windowMinutes) || 30;

    const allowed = await isMember(projectId, userId);
    if (!allowed) {
      return res.json({ status: false, msg: "Not a project member" });
    }

    let messages;
    const cacheKey = keys.messages(projectId);
    const cached = await cacheGet(cacheKey);
    if (cached) {
      messages = cached;
    } else {
      messages = await Message.find({ project: projectId })
        .select("_id createdAt")
        .sort({ createdAt: 1 })
        .lean();
    }

    const result = findBusiestWindow(messages, windowMinutes);
    if (!result) {
      return res.json({
        status: false,
        msg: "Need at least one message to find a busiest stretch",
      });
    }

    return res.json({ status: true, window: result });
  } catch (err) {
    next(err);
  }
};

module.exports.addMessage = async (req, res, next) => {
  try {
    const { projectId, text } = req.body;
    const userId = req.user.id;

    if (!text || !text.trim()) {
      return res.json({ status: false, msg: "Message cannot be empty" });
    }

    const allowed = await isMember(projectId, userId);
    if (!allowed) {
      return res.json({ status: false, msg: "Not a project member" });
    }

    const message = await Message.create({
      project: projectId,
      sender: userId,
      text: text.trim(),
    });

    const fullMessage = await Message.findById(message._id).populate(
      "sender",
      "username avatarImage"
    );

    await invalidate([keys.messages(projectId)]);
    await publishProjectMessage(projectId, fullMessage);

    return res.json({ status: true, message: fullMessage });
  } catch (err) {
    next(err);
  }
};
