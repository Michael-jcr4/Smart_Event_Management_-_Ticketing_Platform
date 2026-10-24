const mongoose = require("mongoose");

const Booking = require("../src/models/Booking");
const Event = require("../src/models/Event");
const { bookTickets, cancelBooking } = require("../src/services/bookingService");
const db = require("./helpers/db");
const { createEvent, daysFromNow } = require("./helpers/fixtures");

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const newUserId = () => new mongoose.Types.ObjectId();

describe("bookTickets", () => {
  test("creates a booking and increases the event's booked count", async () => {
    const event = await createEvent({ totalCapacity: 10, price: 149.99 });
    const userId = newUserId();

    const booking = await bookTickets({ userId, eventId: event._id, quantity: "3" });

    expect(booking.quantity).toBe(3);
    expect(booking.unitPrice).toBe(149.99);
    expect(booking.totalPrice).toBe(449.97);
    expect(booking.status).toBe("confirmed");
    expect((await Event.findById(event._id)).bookedCount).toBe(3);
  });

  test.each([0, 11, 1.5, -2, "abc", ""])("rejects an invalid quantity (%p)", async (quantity) => {
    const event = await createEvent();

    await expect(bookTickets({ userId: newUserId(), eventId: event._id, quantity })).rejects.toMatchObject({ status: 400 });
    expect((await Event.findById(event._id)).bookedCount).toBe(0);
  });

  test("won't sell more tickets than are left", async () => {
    const event = await createEvent({ totalCapacity: 3, bookedCount: 2 });

    await expect(bookTickets({ userId: newUserId(), eventId: event._id, quantity: 2 })).rejects.toMatchObject({
      status: 409,
      message: "Only 1 ticket(s) are left for this event.",
    });
    expect((await Event.findById(event._id)).bookedCount).toBe(2);
  });

  test("reports a sold-out event", async () => {
    const event = await createEvent({ totalCapacity: 5, bookedCount: 5 });

    await expect(bookTickets({ userId: newUserId(), eventId: event._id, quantity: 1 })).rejects.toMatchObject({
      status: 409,
      message: "Sorry, this event is sold out.",
    });
  });

  test("never oversells when many people book the last tickets at once", async () => {
    const event = await createEvent({ totalCapacity: 5 });

    // 20 simultaneous single-ticket bookings for 5 seats.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => bookTickets({ userId: newUserId(), eventId: event._id, quantity: 1 }))
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(5);
    expect(failed).toHaveLength(15);
    failed.forEach((r) => expect(r.reason.status).toBe(409));

    expect((await Event.findById(event._id)).bookedCount).toBe(5);
    expect(await Booking.countDocuments({ event: event._id })).toBe(5);
  });

  test("closes bookings once the event has started", async () => {
    const event = await createEvent({ startDate: daysFromNow(-1), endDate: daysFromNow(1) });

    await expect(bookTickets({ userId: newUserId(), eventId: event._id, quantity: 1 })).rejects.toMatchObject({ status: 409 });
  });

  test("returns 404 for a missing or malformed event id", async () => {
    await expect(bookTickets({ userId: newUserId(), eventId: new mongoose.Types.ObjectId(), quantity: 1 })).rejects.toMatchObject({ status: 404 });
    await expect(bookTickets({ userId: newUserId(), eventId: "not-an-id", quantity: 1 })).rejects.toMatchObject({ status: 404 });
  });
});

describe("cancelBooking", () => {
  test("cancels the booking and releases its tickets, only once", async () => {
    const event = await createEvent({ totalCapacity: 10 });
    const userId = newUserId();
    const booking = await bookTickets({ userId, eventId: event._id, quantity: 4 });

    const cancelled = await cancelBooking({ userId, bookingId: booking._id });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    expect((await Event.findById(event._id)).bookedCount).toBe(0);

    await expect(cancelBooking({ userId, bookingId: booking._id })).rejects.toMatchObject({ status: 409 });
    expect((await Event.findById(event._id)).bookedCount).toBe(0);
  });

  test("a double-submitted cancel only releases tickets once", async () => {
    const event = await createEvent({ totalCapacity: 10 });
    const userId = newUserId();
    const booking = await bookTickets({ userId, eventId: event._id, quantity: 4 });
    await bookTickets({ userId: newUserId(), eventId: event._id, quantity: 2 });

    await Promise.allSettled([cancelBooking({ userId, bookingId: booking._id }), cancelBooking({ userId, bookingId: booking._id })]);

    expect((await Event.findById(event._id)).bookedCount).toBe(2);
  });

  test("users can't cancel someone else's booking", async () => {
    const event = await createEvent();
    const booking = await bookTickets({ userId: newUserId(), eventId: event._id, quantity: 1 });

    await expect(cancelBooking({ userId: newUserId(), bookingId: booking._id })).rejects.toMatchObject({ status: 404 });
    expect((await Booking.findById(booking._id)).status).toBe("confirmed");
  });
});
