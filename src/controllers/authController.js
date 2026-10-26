const User = require("../models/User");
const { safeRedirectPath } = require("../middleware/auth");
const { setFlash } = require("../middleware/locals");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

// New session ID on every login/registration, to prevent session fixation.
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function showRegister(req, res) {
  res.render("auth/register", { title: "Register", errors: [], values: {} });
}

async function register(req, res) {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const confirmPassword = String(req.body.confirmPassword || "");

  const errors = [];
  if (name.length < 2) errors.push("Name must be at least 2 characters long.");
  if (!EMAIL_PATTERN.test(email)) errors.push("Please enter a valid email address.");
  if (password.length < MIN_PASSWORD_LENGTH) errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  if (password !== confirmPassword) errors.push("Passwords do not match.");

  const renderErrors = (messages) =>
    res.status(400).render("auth/register", { title: "Register", errors: messages, values: { name, email } });

  if (errors.length > 0) return renderErrors(errors);

  let user;
  try {
    // The role is never read from the form: everyone who signs up is a regular
    // user. Admin accounts are created with `npm run seed`.
    user = await User.create({ name, email, password: await User.hashPassword(password) });
  } catch (err) {
    if (err.code === 11000) return renderErrors(["An account with that email already exists."]);
    if (err.name === "ValidationError") return renderErrors(Object.values(err.errors).map((e) => e.message));
    throw err;
  }

  await regenerateSession(req);
  req.session.user = user.toSessionUser();
  setFlash(req, "success", `Welcome, ${user.name}! Your account has been created.`);
  return res.redirect("/dashboard");
}

function showLogin(req, res) {
  res.render("auth/login", { title: "Log in", error: null, values: {}, next: safeRedirectPath(req.query.next, "") });
}

async function login(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const next = safeRedirectPath(req.body.next);

  const fail = (status, error) =>
    res.status(status).render("auth/login", { title: "Log in", error, values: { email }, next: req.body.next || "" });

  if (!email || !password) return fail(400, "Please enter both email and password.");

  const user = await User.findOne({ email }).select("+password");
  // Same message whether the email or the password was wrong, so the form
  // can't be used to find out which emails have accounts.
  if (!user || !(await user.verifyPassword(password))) {
    return fail(401, "Invalid email or password.");
  }

  await regenerateSession(req);
  req.session.user = user.toSessionUser();
  return res.redirect(next);
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("sid");
    return res.redirect("/");
  });
}

module.exports = { showRegister, register, showLogin, login, logout };
