const Message = require("../models/messageModel");
const Project = require("../models/projectModel");

async function isMember(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) return false;
  return project.members.some((m) => m.user.toString() === userId);
}

module.exports.getMessages = async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;

    const allowed = await isMember(projectId, userId);
    if (!allowed) {
      return res.json({ status: false, msg: "Not a project member" });
    }

    const messages = await Message.find({ project: projectId })
      .populate("sender", "username")
      .sort({ createdAt: 1 });

    return res.json({ status: true, messages });
  } catch (err) {
    next(err);
  }
};

module.exports.addMessage = async (req, res, next) => {
  try {
    const { projectId, userId, text } = req.body;

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
      "username"
    );

    return res.json({ status: true, message: fullMessage });
  } catch (err) {
    next(err);
  }
};
