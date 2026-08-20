require("dotenv").config();

const express = require("express");
const cors = require("cors");
const socket = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

const { connectDB } = require("./config/db");
const {
  connectRedis,
  redisAdapterPub,
  redisAdapterSub,
} = require("./config/redis");
const { listenForInvalidation } = require("./utils/cache");
const { subscribeProjectMessages } = require("./pubsub");
const { apiLimiter } = require("./middleware/rateLimit");

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const messageRoutes = require("./routes/messages");
const pollRoutes = require("./routes/polls");
const aiRoutes = require("./routes/ai");

const app = express();

app.use(
  cors({
    origin: process.env.ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(apiLimiter);

app.get("/", (req, res) => {
  res.json({
    status: true,
    msg: "SquadForge server is running",
    features: [
      "jwt-access-refresh",
      "redis-rate-limit",
      "redis-cache",
      "mongo-pooling",
      "redis-pubsub",
    ],
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/polls", pollRoutes);
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 5001;

async function start() {
  await connectDB();
  await connectRedis();
  listenForInvalidation();

  const server = app.listen(PORT, () => {
    console.log("Server started on port", PORT);
  });

  const io = socket(server, {
    cors: {
      origin: process.env.ORIGIN || "http://localhost:3000",
      credentials: true,
    },
  });

  io.adapter(createAdapter(redisAdapterPub, redisAdapterSub));

  io.on("connection", (socketConn) => {
    socketConn.on("join-project", (projectId) => {
      socketConn.join(projectId);
    });
  });

  // HTTP addMessage publishes → every instance emits to its local rooms
  subscribeProjectMessages(({ projectId, message }) => {
    io.to(projectId).emit("receive-project-msg", message);
  });
}

start().catch((err) => {
  console.log("Failed to start server:", err.message);
  console.log("Tip: is Redis running? Try: brew services start redis  OR  docker compose up -d");
  process.exit(1);
});
