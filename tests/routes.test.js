const request = require("supertest");

const { createApp } = require("../src/app");
const Booking = require("../src/models/Booking");
const Enquiry = require("../src/models/Enquiry");
const Event = require("../src/models/Event");
const db = require("./helpers/db");
const { createUser, createEvent, daysFromNow, postForm, loginAs, text } = require("./helpers/fixtures");

let app;

beforeAll(async () => {
  await db.connect();
  app = createApp();
});
afterEach(db.clear);
afterAll(db.close);

describe("public event pages", () => {
  test("home page lists upcoming events and hides finished ones", async () => {
    await createEvent({ title: "Future Fest" });
    await createEvent({ title: "Last Year Expo", startDate: daysFromNow(-30), endDate: daysFromNow(-29) });

    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Future Fest");
    expect(res.text).not.toContain("Last Year Expo");
  });

  test("search matches titles and treats regex characters literally", async () => {
    await createEvent({ title: "Node.js Workshop", category: "Workshop" });
    await createEvent({ title: "Jazz Evening", category: "Festival" });

    const search = await request(app).get("/").query({ search: "node.js" });
    expect(search.text).toContain("Node.js Workshop");
    expect(search.text).not.toContain("Jazz Evening");

    const weird = await request(app).get("/").query({ search: "((.*" });
    expect(weird.status).toBe(200);
    expect(weird.text).toContain("No events match your search.");
  });

  test("filters by category and availability", async () => {
    await createEvent({ title: "Open Workshop", category: "Workshop" });
    await createEvent({ title: "Full Workshop", category: "Workshop", totalCapacity: 2, bookedCount: 2 });
    await createEvent({ title: "Big Conference", category: "Conference" });

    const res = await request(app).get("/").query({ category: "Workshop", availability: "available" });

    expect(res.text).toContain("Open Workshop");
    expect(res.text).not.toContain("Full Workshop");
    expect(res.text).not.toContain("Big Conference");
  });

  test("event page returns 404 for unknown or malformed ids", async () => {
    expect((await request(app).get("/events/64b000000000000000000000")).status).toBe(404);
    expect((await request(app).get("/events/not-an-id")).status).toBe(404);
  });
});

describe("booking through the website", () => {
  test("logged-out visitors are sent to the login page", async () => {
    const event = await createEvent();
    const res = await postForm(request.agent(app), `/events/${event._id}/book`, { quantity: 1 });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/login/);
    expect(await Booking.countDocuments()).toBe(0);
  });

  test("a user can book tickets and see them on their dashboard", async () => {
    const event = await createEvent({ title: "Booking Test Event", price: 100 });
    const agent = await loginAs(app, await createUser());

    const res = await postForm(agent, `/events/${event._id}/book`, { quantity: 2 });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/dashboard");

    const dashboard = await agent.get("/dashboard");
    expect(dashboard.text).toContain("Booking confirmed: 2 ticket(s), total R200.00.");
    expect(dashboard.text).toContain("Booking Test Event");
    expect((await Event.findById(event._id)).bookedCount).toBe(2);
  });

  test("booking a sold-out event shows a message on the event page", async () => {
    const event = await createEvent({ totalCapacity: 1, bookedCount: 1 });
    const agent = await loginAs(app, await createUser());

    const res = await postForm(agent, `/events/${event._id}/book`, { quantity: 1 });
    expect(res.headers.location).toBe(`/events/${event._id}`);

    const page = await agent.get(`/events/${event._id}`);
    expect(page.text).toContain("Sorry, this event is sold out.");
  });

  test("a user can cancel their booking from the dashboard", async () => {
    const event = await createEvent();
    const agent = await loginAs(app, await createUser());
    await postForm(agent, `/events/${event._id}/book`, { quantity: 3 });
    const booking = await Booking.findOne();

    const res = await postForm(agent, `/bookings/${booking._id}/cancel`);

    expect(res.headers.location).toBe("/dashboard");
    expect((await Booking.findById(booking._id)).status).toBe("cancelled");
    expect((await Event.findById(event._id)).bookedCount).toBe(0);
  });
});

const eventForm = {
    title: "Admin Created Event",
    description: "Created through the admin form.",
    category: "Workshop",
    location: "Pretoria",
    startDate: "2035-03-01T10:00",
    endDate: "2035-03-01T15:00",
    totalCapacity: "40",
    price: "99.50",
  };

describe("admin event management", () => {

  test("regular users can't access admin pages or actions", async () => {
    const agent = await loginAs(app, await createUser());

    expect((await agent.get("/admin/events")).status).toBe(403);
    expect((await postForm(agent, "/admin/events", eventForm)).status).toBe(403);
    expect(await Event.countDocuments()).toBe(0);
  });

  test("admins can create an event", async () => {
    const agent = await loginAs(app, await createUser({ role: "admin" }));

    const res = await postForm(agent, "/admin/events", eventForm);

    expect(res.status).toBe(302);
    const event = await Event.findOne({ title: "Admin Created Event" });
    expect(event.totalCapacity).toBe(40);
    expect(event.price).toBe(99.5);
  });

  test("rejects an end date before the start date", async () => {
    const agent = await loginAs(app, await createUser({ role: "admin" }));

    const res = await postForm(agent, "/admin/events", { ...eventForm, endDate: "2035-02-01T10:00" });

    expect(res.status).toBe(400);
    expect(text(res)).toContain("End date cannot be before start date.");
    expect(await Event.countDocuments()).toBe(0);
  });

  test("capacity can't be reduced below tickets already booked", async () => {
    const event = await createEvent({ totalCapacity: 50, bookedCount: 30 });
    const agent = await loginAs(app, await createUser({ role: "admin" }));

    const res = await postForm(agent, `/admin/events/${event._id}`, { ...eventForm, totalCapacity: "20" });

    expect(res.status).toBe(409);
    expect(text(res)).toContain("Capacity can't be lower than the 30 ticket(s) already booked.");
    expect((await Event.findById(event._id)).totalCapacity).toBe(50);
  });

  test("events with confirmed bookings can't be deleted", async () => {
    const event = await createEvent();
    const customer = await createUser();
    await Booking.create({ user: customer._id, event: event._id, quantity: 1, unitPrice: 150, totalPrice: 150 });
    const agent = await loginAs(app, await createUser({ role: "admin" }));

    await postForm(agent, `/admin/events/${event._id}/delete`);
    expect(await Event.exists({ _id: event._id })).toBeTruthy();

    await Booking.updateMany({}, { status: "cancelled" });
    await postForm(agent, `/admin/events/${event._id}/delete`);
    expect(await Event.exists({ _id: event._id })).toBeFalsy();
  });
});

describe("organisers", () => {
  test("can create an event, which is saved as theirs", async () => {
    const organiser = await createUser({role: "organiser"});
    const agent = await loginAs(app, organiser);

    const res = await postForm(agent, "/admin/events", eventForm);

    expect(res.status).toBe(302);
    const event = await Event.findOne({ title: "Admin Created Event"});
    expect(event.createdBy.toString()).toBe(organiser._id.toString());
  });

  test("only see their own events on manage events screen", async () => {
    const organiser1 = await createUser({role: "organiser"});
    const organiser2 = await createUser({role: "organiser"});
    await createEvent({title: "Organiser 1's Event", createdBy: organiser1._id});
    await createEvent({title: "organiser 2's Event", createdBy: organiser2._id});
    const agent = await loginAs(app, organiser1);

    const res = await agent.get("/admin/events");

    expect(res.status).toBe(200);
    expect(text(res)).toContain("Organiser 1's Event");
    expect(text(res)).not.toContain("organiser 2's Event");
  })

  test("cant view, edit or delete another organisers event", async () => {
    const owner = await createUser({role: "organiser"});
    const intruder =  await createUser({role: "organiser"});
    const event = await createEvent({title: "Owner's event", createdBy: owner._id});
    const agent = await loginAs(app, intruder);

    const editPage = await agent.get(`/admin/event/${event._id}/edit`);
    const update = await postForm(agent, `/admin/events/${event._id}`, {...eventForm, title:"Hacked"});
    const remove = await postForm(agent, `/admin/events/${event._id}/delete`);

    expect(editPage.status).toBe(404);
    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);
    
    const unchanged = await Event.findById(event._id);
    expect(unchanged.title).toBe("Owner's event")
  });

  test("admins can still edit an organiser's event", async () => {
    const admin = await createUser({role: "admin"});
    const organiser = await createUser({role: "organiser"});
    const event = await createEvent({title: "Organiser's Event", createdBy: organiser._id});
    const agent = await loginAs(app, admin);

    const res = await postForm(agent, `/admin/events/${event._id}`, {...eventForm, title: "Edited By Admin"});

    expect(res.status).toBe(302);
    const updated = await Event.findById(event._id);
    expect(updated.title).toBe("Edited By Admin");
  });
});

describe("contact enquiries", () => {
  const enquiry = { name: "Sipho", email: "sipho@example.com", subject: "Group booking", message: "Can I book 30 seats?" };

  test("anyone can submit an enquiry", async () => {
    const res = await postForm(request.agent(app), "/contact", enquiry);

    expect(res.status).toBe(302);
    expect(await Enquiry.countDocuments({ email: "sipho@example.com" })).toBe(1);
  });

  test("only admins can see and update enquiries", async () => {
    const saved = await Enquiry.create(enquiry);

    const userAgent = await loginAs(app, await createUser());
    expect((await userAgent.get("/contact")).text).not.toContain("Can I book 30 seats?");
    expect((await postForm(userAgent, `/contact/${saved._id}/status`, { status: "Resolved" })).status).toBe(403);

    const adminAgent = await loginAs(app, await createUser({ role: "admin" }));
    expect((await adminAgent.get("/contact")).text).toContain("Can I book 30 seats?");
    await postForm(adminAgent, `/contact/${saved._id}/status`, { status: "Resolved" });
    expect((await Enquiry.findById(saved._id)).status).toBe("Resolved");
  });
});
