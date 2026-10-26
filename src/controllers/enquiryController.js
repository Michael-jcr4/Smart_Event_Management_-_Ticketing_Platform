const Enquiry = require("../models/Enquiry");
const { STATUSES } = require("../models/Enquiry");
const { setFlash } = require("../middleware/locals");
const HttpError = require("../utils/httpError");

async function renderContact(req, res, { status = 200, errors = [], values = {} } = {}) {
  const isAdmin = req.session.user && req.session.user.role === "admin";
  const enquiries = isAdmin ? await Enquiry.find().sort({ createdAt: -1 }).limit(200).lean() : [];

  res.status(status).render("contact", { title: "Contact", enquiries, errors, values, statuses: STATUSES });
}

// GET /contact — enquiry form, plus the enquiry inbox for admins.
async function show(req, res) {
  const user = req.session.user;
  await renderContact(req, res, { values: user ? { name: user.name, email: user.email } : {} });
}

// POST /contact — anyone can submit; logged-in users are linked to their enquiry.
async function submit(req, res) {
  const values = {
    name: String(req.body.name || "").trim(),
    email: String(req.body.email || "").trim(),
    subject: String(req.body.subject || "").trim(),
    message: String(req.body.message || "").trim(),
  };

  if (Object.values(values).some((v) => !v)) {
    return renderContact(req, res, { status: 400, errors: ["Please complete all fields."], values });
  }

  try {
    await Enquiry.create({ ...values, submittedBy: req.session.user ? req.session.user._id : undefined });
  } catch (err) {
    if (err.name !== "ValidationError") throw err;
    return renderContact(req, res, { status: 400, errors: Object.values(err.errors).map((e) => e.message), values });
  }

  // Redirect after POST so refreshing the page doesn't resubmit the enquiry.
  setFlash(req, "success", "Thanks! Your enquiry has been submitted and our team will be in touch.");
  return res.redirect("/contact");
}

// POST /contact/:id/status (admin)
async function updateStatus(req, res) {
  const { status } = req.body;
  if (!STATUSES.includes(status)) throw new HttpError(400, "Invalid enquiry status.");

  const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, { status }, { returnDocument: "after" });
  if (!enquiry) throw new HttpError(404, "Enquiry not found.");

  setFlash(req, "success", `Enquiry from ${enquiry.name} marked as ${status}.`);
  res.redirect("/contact#enquiries");
}

// POST /contact/:id/delete (admin)
async function remove(req, res) {
  const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
  if (!enquiry) throw new HttpError(404, "Enquiry not found.");

  setFlash(req, "success", "Enquiry deleted.");
  res.redirect("/contact#enquiries");
}

module.exports = { show, submit, updateStatus, remove };
