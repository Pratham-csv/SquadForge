const Message = require("../models/messageModel");
const Project = require("../models/projectModel");

async function isMember(projectId, userId) {
  const project = await Project.findById(projectId);
  if (!project) return false;
  return project.members.some((m) => m.user.toString() === userId);
}

function buildContext(messages) {
  return messages
    .map((msg) => {
      const name = msg.sender?.username || "Unknown";
      const time = new Date(msg.createdAt).toISOString();
      return `[${time}] ${name}: ${msg.text}`;
    })
    .join("\n");
}

function localFallbackAnswer(messages, question) {
  const speakers = [
    ...new Set(messages.map((m) => m.sender?.username || "Unknown")),
  ];
  const lines = messages.map((m) => {
    const name = m.sender?.username || "Unknown";
    return `- ${name}: ${m.text}`;
  });

  const q = question.toLowerCase();
  let focus = lines;

  if (!(q.includes("summar") || q.includes("summary") || q.includes("catch"))) {
    const keywords = q
      .replace(/[?.,!]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const matched = lines.filter((line) =>
      keywords.some((k) => line.toLowerCase().includes(k))
    );
    if (matched.length > 0) {
      focus = matched;
    }
  }

  return `AI providers were unavailable, so SquadForge used local catch-up mode.

Your question: ${question}

People in this range: ${speakers.join(", ")}
Messages used: ${messages.length}

Relevant chat:
${focus.join("\n")}

Tip: Add a valid GROQ_API_KEY in server/.env for full AI answers.`;
}

async function askGroq(context, question) {
  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY missing in server .env");
  }

  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are SquadForge AI helper for a student project chat.\n" +
              "Rules:\n" +
              "1) Use the selected chat as the main context for project decisions, tasks, names, and what the team said.\n" +
              "2) If the user asks what a term/concept means (example: webhook, API, JWT) and that term appears in the chat, explain it clearly in simple words. You may use general knowledge for definitions.\n" +
              "3) For project-specific questions (who decided what, what was assigned), only use facts from the chat. If that info is missing, say it is not in the selected messages.\n" +
              "4) Keep answers short and clear.",
          },
          {
            role: "user",
            content: `CHAT CONTEXT:\n${context}\n\nUSER QUESTION:\n${question}`,
          },
        ],
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Groq API request failed");
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (!answer) {
    throw new Error("No answer returned from Groq");
  }

  return { answer, source: "groq", model };
}

async function askGemini(context, question) {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY missing in server .env");
  }

  const prompt = `You are SquadForge AI helper for a student project chat.
Rules:
1) Use the selected chat as the main context for project decisions, tasks, names, and what the team said.
2) If the user asks what a term/concept means (example: webhook, API, JWT) and that term appears in the chat, explain it clearly in simple words. You may use general knowledge for definitions.
3) For project-specific questions (who decided what, what was assigned), only use facts from the chat. If that info is missing, say it is not in the selected messages.
4) Keep answers short and clear.

CHAT CONTEXT:
${context}

USER QUESTION:
${question}`;

  const models = [
    process.env.GEMINI_MODEL,
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-001",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
  ].filter(Boolean);

  let lastError = "No Gemini model worked";

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        answer:
          data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          "No answer returned from Gemini.",
        source: "gemini",
        model,
      };
    }

    lastError = data?.error?.message || `Model ${model} failed`;
  }

  throw new Error(lastError);
}

async function askAI(context, question) {
  const errors = [];

  // 1) Groq first (free and works well for students)
  if ((process.env.GROQ_API_KEY || "").trim()) {
    try {
      return await askGroq(context, question);
    } catch (err) {
      errors.push(`Groq: ${err.message}`);
    }
  }

  // 2) Gemini optional backup
  if ((process.env.GEMINI_API_KEY || "").trim()) {
    try {
      return await askGemini(context, question);
    } catch (err) {
      errors.push(`Gemini: ${err.message}`);
    }
  }

  throw new Error(errors.join(" | ") || "No AI provider configured");
}

module.exports.askAboutChat = async (req, res, next) => {
  try {
    const {
      projectId,
      question,
      startMessageId,
      endMessageId,
      fromDate,
      toDate,
    } = req.body;

    const userId = req.user.id;

    if (!question || !question.trim()) {
      return res.json({ status: false, msg: "Question is required" });
    }

    const allowed = await isMember(projectId, userId);
    if (!allowed) {
      return res.json({ status: false, msg: "Not a project member" });
    }

    let messages = [];

    if (startMessageId && endMessageId) {
      const all = await Message.find({ project: projectId })
        .populate("sender", "username")
        .sort({ createdAt: 1 });

      const startIndex = all.findIndex(
        (m) => m._id.toString() === startMessageId
      );
      const endIndex = all.findIndex((m) => m._id.toString() === endMessageId);

      if (startIndex === -1 || endIndex === -1) {
        return res.json({ status: false, msg: "Start or end message not found" });
      }

      const from = Math.min(startIndex, endIndex);
      const to = Math.max(startIndex, endIndex);
      messages = all.slice(from, to + 1);
    } else if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      messages = await Message.find({
        project: projectId,
        createdAt: { $gte: from, $lte: to },
      })
        .populate("sender", "username")
        .sort({ createdAt: 1 });
    } else {
      return res.json({
        status: false,
        msg: "Select two messages OR a date range",
      });
    }

    if (messages.length === 0) {
      return res.json({ status: false, msg: "No messages in selected range" });
    }

    if (messages.length > 120) {
      return res.json({
        status: false,
        msg: "Selected range is too large. Pick a smaller range (max 120 messages).",
      });
    }

    const context = buildContext(messages);

    try {
      const result = await askAI(context, question.trim());
      return res.json({
        status: true,
        answer: result.answer,
        usedMessages: messages.length,
        source: result.source,
        model: result.model,
      });
    } catch (aiErr) {
      const answer = localFallbackAnswer(messages, question.trim());
      return res.json({
        status: true,
        answer,
        usedMessages: messages.length,
        source: "local-fallback",
        aiError: aiErr.message,
      });
    }
  } catch (err) {
    return res.json({ status: false, msg: err.message || "AI request failed" });
  }
};
