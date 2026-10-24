const HttpError = require("../utils/httpError");

function notFound(req, res, next) {
  next(new HttpError(404, "We couldn't find that page."));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.expose ? err.message : "Something went wrong on our side. Please try again.";

  // A malformed ObjectId in the URL means the thing doesn't exist.
  if (err.name === "CastError") {
    status = 404;
    message = "We couldn't find that page.";
  }

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).render("error", { title: status === 404 ? "Not found" : "Error", status, message });
}

module.exports = { notFound, errorHandler };
