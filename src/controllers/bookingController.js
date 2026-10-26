const { setFlash } = require("../middleware/locals");
const { bookTickets, cancelBooking } = require("../services/bookingService");
const { money } = require("../utils/format");
const HttpError = require("../utils/httpError");

// POST /events/:id/book
async function create(req, res) {
  try {
    const booking = await bookTickets({
      userId: req.session.user._id,
      eventId: req.params.id,
      quantity: req.body.quantity,
    });
    setFlash(req, "success", `Booking confirmed: ${booking.quantity} ticket(s), total ${money(booking.totalPrice)}.`);
    return res.redirect("/dashboard");
  } catch (err) {
    // Expected problems (sold out, bad quantity, event started) go back to the
    // event page as a message; anything else goes to the error handler.
    if (err instanceof HttpError && err.status !== 404) {
      setFlash(req, "error", err.message);
      return res.redirect(`/events/${req.params.id}`);
    }
    throw err;
  }
}

// POST /bookings/:id/cancel
async function cancel(req, res) {
  try {
    await cancelBooking({ userId: req.session.user._id, bookingId: req.params.id });
    setFlash(req, "success", "Your booking has been cancelled and the tickets released.");
  } catch (err) {
    if (!(err instanceof HttpError) || err.status === 404) throw err;
    setFlash(req, "error", err.message);
  }
  return res.redirect("/dashboard");
}

module.exports = { create, cancel };
