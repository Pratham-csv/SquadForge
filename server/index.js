const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const socket = require("socket.io");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const messageRoutes = require("./routes/messages");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("SquadForge server is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/messages", messageRoutes);

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("DB connected");
  })
  .catch((err) => {
    console.log("DB error:", err.message);
  });

const PORT = process.env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});

const io = socket(server, {
  cors: {
    origin: process.env.ORIGIN || "http://localhost:3000",
    credentials: true,
  },
});

io.on("connection", (socket) => {
  socket.on("join-project", (projectId) => {
    socket.join(projectId);
  });

  socket.on("send-project-msg", (data) => {
    socket.to(data.projectId).emit("receive-project-msg", data.message);
  });
});
