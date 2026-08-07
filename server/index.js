const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const projectRoutes = require("./routes/projects");
require("dotenv").config();

const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("SquadForge server is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);


mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("DB connected");
  })
  .catch((err) => {
    console.log("DB error:", err.message);
  });

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});