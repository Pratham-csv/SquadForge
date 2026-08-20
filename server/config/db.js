const mongoose = require("mongoose");

/**
 * MongoDB connection with explicit pooling.
 * Pooling = keep a set of open DB sockets ready so each request
 * does not open/close a new connection (expensive).
 */
async function connectDB() {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error("MONGO_URL missing in .env");
  }

  await mongoose.connect(uri, {
    maxPoolSize: Number(process.env.MONGO_MAX_POOL || 10), // max parallel sockets
    minPoolSize: Number(process.env.MONGO_MIN_POOL || 2), // keep warm sockets
    maxIdleTimeMS: 30000, // close idle sockets after 30s
    serverSelectionTimeoutMS: 10000,
  });

  console.log(
    `DB connected (pool min=${process.env.MONGO_MIN_POOL || 2}, max=${
      process.env.MONGO_MAX_POOL || 10
    })`
  );
}

module.exports = { connectDB };
