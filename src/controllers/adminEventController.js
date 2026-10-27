const Booking = require("../models/Booking");
const Event = require("../models/Event");
const { CATEGORIES } = require("../models/Event");
const { setFlash } = require("../middleware/locals");
const HttpError = require("../utils/httpError");

// Parse and check the fields mongoose can't validate on its own
// (dates relative to each other, numbers typed into text boxes).
function readEventForm(body) {
  const errors = [];
  const toDate = (value, label) => {
    const d = new Date(String(value || ""));
    if (!value || Number.isNaN(d.getTime())) {
      errors.push(`Please enter a valid ${label}.`);
      return undefined;
    }
    return d;
  };

  const data = {
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim(),
    category: String(body.category || ""),
    location: String(body.location || "").trim(),
    startDate: toDate(body.startDate, "start date"),
    endDate: toDate(body.endDate, "end date"),
    totalCapacity: Number(body.totalCapacity),
    price: Number(body.price),
  };

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    errors.push("End date cannot be before start date.");
  }
  if (!Number.isInteger(data.totalCapacity) || data.totalCapacity < 1) {
    errors.push("Capacity must be a whole number of at least 1.");
  }
  if (!Number.isFinite(data.price) || data.price < 0) {
    errors.push("Price must be zero or more.");
  }

  return { data, errors };
}

function ownedEvents(req) {
  const user = req.session.user;
  return user.role === "admin" ? {} : {createdBy: user._id};
}

function renderForm(res, { status = 200, event, errors = [], isEdit = false }) {
  res.status(status).render("admin/events/form", {
    title: isEdit ? "Edit event" : "Create event",
    event,
    errors,
    isEdit,
    categories: CATEGORIES,
  });
}

async function list(req, res) {
  const events = await Event.find(ownedEvents(req)).sort({ startDate: 1 }).lean();
  res.render("admin/events/index", { title: "Manage events", events });
}

function newForm(req, res) {
  renderForm(res, { event: {} });
}

async function create(req, res) {
  const { data, errors } = readEventForm(req.body);
  if (errors.length > 0) return renderForm(res, { status: 400, event: data, errors });

  try {
    await Event.create({ ...data, createdBy: req.session.user._id });
  } catch (err) {
    if (err.name !== "ValidationError") throw err;
    return renderForm(res, { status: 400, event: data, errors: Object.values(err.errors).map((e) => e.message) });
  }

  setFlash(req, "success", `Created "${data.title}".`);
  return res.redirect("/admin/events");
}

async function editForm(req, res) {
  const event = await Event.findOne({ _id: req.params.id, ...ownedEvents(req) }).lean();
  if (!event) throw new HttpError(404, "Event not found.");
  renderForm(res, { event, isEdit: true });
}

async function update(req, res) {
  const { data, errors } = readEventForm(req.body);
  const event = { ...data, _id: req.params.id };
  if (errors.length > 0) return renderForm(res, { status: 400, event, errors, isEdit: true });

  let updated;
  try {
    // The bookedCount condition makes "capacity can't drop below tickets
    // already sold" part of the same atomic write as the update itself.
    updated = await Event.findOneAndUpdate(
      { _id: req.params.id, ...ownedEvents(req), bookedCount: { $lte: data.totalCapacity } },
      data,
      { returnDocument: "after", runValidators: true }
    );
  } catch (err) {
    if (err.name !== "ValidationError") throw err;
    return renderForm(res, { status: 400, event, errors: Object.values(err.errors).map((e) => e.message), isEdit: true });
  }

  if (!updated) {
    const existing = await Event.findOne({_id: req.params.id, ...ownedEvents(req)}).lean();
    if (!existing) throw new HttpError(404, "Event not found.");
    return renderForm(res, {
      status: 409,
      event,
      errors: [`Capacity can't be lower than the ${existing.bookedCount} ticket(s) already booked.`],
      isEdit: true,
    });
  }

  setFlash(req, "success", `Updated "${updated.title}".`);
  return res.redirect("/admin/events");
}

async function remove(req, res) {
  const event = await Event.findOne({ _id: req.params.id, ...ownedEvents(req) });
  if (!event) throw new HttpError(404, "Event not found.");

  if (await Booking.exists({ event: event._id, status: "confirmed" })) {
    setFlash(req, "error", `"${event.title}" has confirmed bookings and can't be deleted.`);
    return res.redirect("/admin/events");
  }

  await Booking.deleteMany({ event: event._id });
  await event.deleteOne();
  setFlash(req, "success", `Deleted "${event.title}".`);
  return res.redirect("/admin/events");
}

module.exports = { list, newForm, create, editForm, update, remove };
