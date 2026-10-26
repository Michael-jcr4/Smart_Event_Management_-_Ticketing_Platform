const mongoose = require("mongoose");

const Booking = require("../models/Booking");
const Event = require("../models/Event");
const HttpError = require("../utils/httpError");

const MAX_TICKETS_PER_BOOKING = 10;

function parseQuantity(raw) {
  const quantity = Number(raw);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
    throw new HttpError(400, `You can book between 1 and ${MAX_TICKETS_PER_BOOKING} tickets at a time.`);
  }
  return quantity;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Reserve tickets for a user.
 *
 * Capacity is enforced with a single conditional update: the filter only
 * matches when there is room for `quantity` more tickets, and the $inc is
 * applied in the same atomic write. Two requests racing for the last seats
 * can therefore never both succeed, without needing locks or transactions.
 */
async function bookTickets({ userId, eventId, quantity }) {
  const qty = parseQuantity(quantity);
  if (!mongoose.isValidObjectId(eventId)) {
    throw new HttpError(404, "Event not found.");
  }

  const now = new Date();
  const event = await Event.findOneAndUpdate(
    {
      _id: eventId,
      startDate: { $gt: now },
      $expr: { $lte: [{ $add: ["$bookedCount", qty] }, "$totalCapacity"] },
    },
    { $inc: { bookedCount: qty } },
    { returnDocument: "after" }
  );

  if (!event) {
    // The update didn't match; work out why so the user gets a useful message.
    const existing = await Event.findById(eventId).lean();
    if (!existing) throw new HttpError(404, "Event not found.");
    if (existing.startDate <= now) throw new HttpError(409, "Bookings are closed because this event has already started.");
    const left = existing.totalCapacity - existing.bookedCount;
    throw new HttpError(409, left > 0 ? `Only ${left} ticket(s) are left for this event.` : "Sorry, this event is sold out.");
  }

  try {
    return await Booking.create({
      user: userId,
      event: event._id,
      quantity: qty,
      unitPrice: event.price,
      totalPrice: roundMoney(event.price * qty),
    });
  } catch (err) {
    // Compensating action: give the reserved seats back if the booking record
    // couldn't be written. (A multi-document transaction would also work, but
    // needs a replica set, which a local MongoDB install usually isn't.)
    await Event.updateOne({ _id: event._id }, { $inc: { bookedCount: -qty } });
    throw err;
  }
}

/** Cancel one of the user's own bookings and release its seats. */
async function cancelBooking({ userId, bookingId }) {
  if (!mongoose.isValidObjectId(bookingId)) {
    throw new HttpError(404, "Booking not found.");
  }

  const booking = await Booking.findOne({ _id: bookingId, user: userId }).populate("event");
  if (!booking) throw new HttpError(404, "Booking not found.");
  if (booking.status === "cancelled") throw new HttpError(409, "This booking is already cancelled.");
  if (booking.event && booking.event.startDate <= new Date()) {
    throw new HttpError(409, "Bookings can't be cancelled once the event has started.");
  }

  // Conditional status change, so a double-submitted cancel only releases seats once.
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "confirmed" },
    { status: "cancelled", cancelledAt: new Date() },
    { returnDocument: "after" }
  );
  if (!updated) throw new HttpError(409, "This booking is already cancelled.");

  await Event.updateOne({ _id: updated.event }, { $inc: { bookedCount: -updated.quantity } });
  return updated;
}

module.exports = { bookTickets, cancelBooking, parseQuantity, MAX_TICKETS_PER_BOOKING };
