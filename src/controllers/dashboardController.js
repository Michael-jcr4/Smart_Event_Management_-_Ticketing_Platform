const Booking = require("../models/Booking");
const Enquiry = require("../models/Enquiry");
const Event = require("../models/Event");

async function adminDashboard(req, res) {
  const now = new Date();
  const [eventCount, upcomingCount, salesResult, openEnquiries, recentBookings] = await Promise.all([
    Event.countDocuments(),
    Event.countDocuments({ endDate: { $gte: now } }),
    Booking.aggregate([
      { $match: { status: "confirmed" } },
      { $group: { _id: null, bookings: { $sum: 1 }, tickets: { $sum: "$quantity" }, revenue: { $sum: "$totalPrice" } } },
    ]),
    Enquiry.countDocuments({ status: { $ne: "Resolved" } }),
    Booking.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("user", "name email")
      .populate("event", "title startDate")
      .lean(),
  ]);

  const sales = salesResult[0] || { bookings: 0, tickets: 0, revenue: 0 };

  res.render("dashboard/admin", {
    title: "Admin dashboard",
    stats: { eventCount, upcomingCount, openEnquiries, ...sales },
    recentBookings,
  });
}

// GET /dashboard — admins see platform stats, everyone else sees their bookings.
async function show(req, res) {
  if (req.session.user.role === "admin") return adminDashboard(req, res);

  const bookings = await Booking.find({ user: req.session.user._id })
    .sort({ createdAt: -1 })
    .populate("event", "title startDate endDate location")
    .lean();

  return res.render("dashboard/user", { title: "My bookings", bookings, now: new Date() });
}

module.exports = { show };
