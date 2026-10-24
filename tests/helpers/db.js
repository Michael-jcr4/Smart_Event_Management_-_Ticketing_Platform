const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// Register every model so their indexes (e.g. unique email) get built.
require("../../src/models/Booking");
require("../../src/models/Enquiry");
require("../../src/models/Event");
require("../../src/models/User");

let server;

async function connect() {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

async function clear() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

async function close() {
  await mongoose.disconnect();
  if (server) await server.stop();
}

module.exports = { connect, clear, close };
