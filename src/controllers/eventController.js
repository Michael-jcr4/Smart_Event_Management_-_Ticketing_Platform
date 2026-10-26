const Event = require("../models/Event");
const { CATEGORIES } = require("../models/Event");
const { MAX_TICKETS_PER_BOOKING } = require("../services/bookingService");
const HttpError = require("../utils/httpError");

// Treat user search text literally, so characters like "(" or ".*" can't
// break the query or be used to build an expensive regular expression.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function readFilters(query) {
  const search = typeof query.search === "string" ? query.search.trim().slice(0, 100) : "";
  const category = CATEGORIES.includes(query.category) ? query.category : "";
  const date = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : "";
  const availability = query.availability === "available" ? "available" : "";
  return { search, category, date, availability };
}

// GET / — public listing of upcoming events with search and filters.
async function home(req, res) {
  const filters = readFilters(req.query);
  const query = { endDate: { $gte: startOfToday() } };

  if (filters.search) {
    const pattern = new RegExp(escapeRegex(filters.search), "i");
    query.$or = [{ title: pattern }, { description: pattern }, { location: pattern }];
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.date) {
    // Events running at any point on the chosen day.
    const dayStart = new Date(`${filters.date}T00:00:00`);
    const dayEnd = new Date(`${filters.date}T23:59:59.999`);
    query.startDate = { $lte: dayEnd };
    query.endDate = { $gte: dayStart > query.endDate.$gte ? dayStart : query.endDate.$gte };
  }

  if (filters.availability) {
    query.$expr = { $lt: ["$bookedCount", "$totalCapacity"] };
  }

  const events = await Event.find(query).sort({ startDate: 1 }).limit(100).lean();

  res.render("home", { title: "Upcoming events", events, filters, categories: CATEGORIES });
}

// GET /events/:id — event details and booking form.
async function show(req, res) {
  const event = await Event.findById(req.params.id);
  if (!event) throw new HttpError(404, "Event not found.");

  res.render("events/show", {
    title: event.title,
    event,
    hasStarted: event.startDate <= new Date(),
    maxPerBooking: Math.min(MAX_TICKETS_PER_BOOKING, event.availableTickets),
  });
}

module.exports = { home, show, escapeRegex };
