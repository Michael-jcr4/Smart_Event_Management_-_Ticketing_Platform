const { rateLimit } = require("express-rate-limit");

const config = require("../config/env");

// Slows down password guessing against the login and register forms.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: (req, res) => {
    res.status(429).render("error", {
      title: "Too many attempts",
      status: 429,
      message: "Too many attempts. Please wait a few minutes and try again.",
    });
  },
});

module.exports = { authLimiter };
