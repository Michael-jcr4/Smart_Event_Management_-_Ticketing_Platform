/**
 * Creates (or updates) an admin account and, if the database has no events
 * yet, adds some sample events.
 *
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='a-long-password' npm run seed
 *
 * Admins can't sign up through the website, so this is how the first one is made.
 */
const mongoose = require("mongoose");

const config = require("../src/config/env");
const Event = require("../src/models/Event");
const User = require("../src/models/User");

function daysFromNow(days, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const SAMPLE_EVENTS = [
  {
    title: "Joburg Tech Summit",
    description: "A full-day conference on cloud, AI and the future of software engineering in Africa, with talks from local engineering leaders.",
    category: "Conference",
    location: "Sandton Convention Centre, Johannesburg",
    startDate: daysFromNow(21, 8),
    endDate: daysFromNow(21, 17),
    totalCapacity: 300,
    price: 450,
  },
  {
    title: "Intro to Docker Workshop",
    description: "Hands-on workshop: build, run and ship your first containerised Node.js app. Bring a laptop.",
    category: "Workshop",
    location: "Belgium Campus, Kempton Park",
    startDate: daysFromNow(10, 13),
    endDate: daysFromNow(10, 16),
    totalCapacity: 25,
    price: 150,
  },
  {
    title: "Highveld Music Festival",
    description: "Two days of live music, food trucks and local artists under the Highveld sky.",
    category: "Festival",
    location: "Riversands Farm Village, Midrand",
    startDate: daysFromNow(35, 12),
    endDate: daysFromNow(36, 23),
    totalCapacity: 1200,
    price: 650,
  },
  {
    title: "Startup Founders Dinner",
    description: "An invite-only networking dinner for early-stage founders and investors.",
    category: "Private",
    location: "Melrose Arch, Johannesburg",
    startDate: daysFromNow(14, 19),
    endDate: daysFromNow(14, 22),
    totalCapacity: 8,
    price: 0,
  },
];

async function seed() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Site Admin" } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) to create the admin account.");
  }

  await mongoose.connect(config.mongoUri);

  const admin = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL.toLowerCase() },
    { name: ADMIN_NAME, role: "admin", password: await User.hashPassword(ADMIN_PASSWORD) },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin account ready: ${admin.email}`);

  if ((await Event.countDocuments()) === 0) {
    await Event.insertMany(SAMPLE_EVENTS.map((e) => ({ ...e, createdBy: admin._id })));
    console.log(`Added ${SAMPLE_EVENTS.length} sample events.`);
  } else {
    console.log("Events already exist; skipped sample events.");
  }
}

seed()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
