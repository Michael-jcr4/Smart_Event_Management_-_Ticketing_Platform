const crypto = require("crypto");
const os = require("os");

const mongoose = require("mongoose");

// Register every model so their indexes (e.g. unique email) get built.
require("../../src/models/Booking");
require("../../src/models/Enquiry");
require("../../src/models/Event");
require("../../src/models/User");

// The server is started once in tests/globalSetup.js. Each test file gets its
// own randomly named database on it, which is dropped when the file finishes.
async function connect() {
  const uri = process.env.TEST_MONGO_URI;
  if (!uri) throw new Error("TEST_MONGO_URI is not set; tests/globalSetup.js should have started MongoDB.");

  await mongoose.connect(uri, {
    dbName: `test_${crypto.randomBytes(6).toString("hex")}`,
    serverSelectionTimeoutMS: 10000,
    // The MongoDB driver loads Node's `os` module with a dynamic import(),
    // which Jest's sandbox doesn't support. The failure is swallowed and the
    // driver then sends an empty handshake, which MongoDB rejects with
    // "Missing required sub-document 'driver'". Passing `os` in directly avoids it.
    runtimeAdapters: { os },
  });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

async function clear() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function close() {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}

module.exports = { connect, clear, close };
