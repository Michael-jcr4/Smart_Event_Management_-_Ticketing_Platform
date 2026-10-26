// Runs once before all test files. Starting MongoDB here (instead of in each
// file's beforeAll) means the first-run download isn't cut off by Jest's
// per-hook timeout, and the server is shared by every test file.
const { MongoMemoryServer } = require("mongodb-memory-server");

module.exports = async () => {
  // Set TEST_MONGO_URI to test against a MongoDB you already run instead,
  // e.g. TEST_MONGO_URI=mongodb://127.0.0.1:27017
  if (process.env.TEST_MONGO_URI) return;

  console.log("\nStarting a temporary MongoDB for the tests (the first run downloads it, which can take a few minutes)...");
  const server = await MongoMemoryServer.create();
  globalThis.__MONGO_SERVER__ = server;
  process.env.TEST_MONGO_URI = server.getUri();
};
