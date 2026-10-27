const express = require("express");

const adminEvents = require("../controllers/adminEventController");
const auth = require("../controllers/authController");
const bookings = require("../controllers/bookingController");
const dashboard = require("../controllers/dashboardController");
const enquiries = require("../controllers/enquiryController");
const events = require("../controllers/eventController");
const { requireAuth, requireRole, requireAdmin } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");

const router = express.Router();

function redirectIfLoggedIn(req, res, next) {
  if (req.session.user) return res.redirect("/dashboard");
  return next();
}

// Public pages
router.get("/", events.home);
router.get("/events/:id", events.show);

// Authentication
router.get("/register", redirectIfLoggedIn, auth.showRegister);
router.post("/register", authLimiter, auth.register);
router.get("/login", redirectIfLoggedIn, auth.showLogin);
router.post("/login", authLimiter, auth.login);
router.post("/logout", auth.logout);

// Bookings and dashboard (logged-in users)
router.post("/events/:id/book", requireAuth, bookings.create);
router.post("/bookings/:id/cancel", requireAuth, bookings.cancel);
router.get("/dashboard", requireAuth, dashboard.show);

// Contact / enquiries
router.get("/contact", enquiries.show);
router.post("/contact", enquiries.submit);
router.post("/contact/:id/status", requireAdmin, enquiries.updateStatus);
router.post("/contact/:id/delete", requireAdmin, enquiries.remove);

// Event management (admins see every event, organisers only see theirs)
const admin = express.Router();
admin.use(requireRole("admin", "organiser"));
admin.get("/events", adminEvents.list);
admin.get("/events/new", adminEvents.newForm);
admin.post("/events", adminEvents.create);
admin.get("/events/:id/edit", adminEvents.editForm);
admin.post("/events/:id", adminEvents.update);
admin.post("/events/:id/delete", adminEvents.remove);
router.use("/admin", admin);

module.exports = router;
