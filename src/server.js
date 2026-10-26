const { MongoStore } = require("connect-mongo");
const mongoose = require("mongoose");

const { createApp } = require("./app");
const config = require("./config/env");

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  const sessionStore = MongoStore.create({
    client: mongoose.connection.getClient(),
    ttl: 8 * 60 * 60,
  });

  const app = createApp({ sessionStore });
  const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start the server:", err.message);
  process.exit(1);
});
