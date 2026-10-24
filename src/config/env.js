const crypto = require("crypto");

require("dotenv").config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProduction) {
    throw new Error("SESSION_SECRET must be set in production.");
  }
  // Fine for local development: sessions just won't survive a restart.
  sessionSecret = crypto.randomBytes(32).toString("hex");
  if (nodeEnv !== "test") {
    console.warn("SESSION_SECRET is not set; using a random secret for this run.");
  }
}

module.exports = {
  nodeEnv,
  isProduction,
  isTest: nodeEnv === "test",
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_event_platform",
  sessionSecret,
};
