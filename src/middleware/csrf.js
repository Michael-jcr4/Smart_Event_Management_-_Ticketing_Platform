const crypto = require("crypto");

const HttpError = require("../utils/httpError");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function tokensMatch(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Synchronizer-token CSRF protection: one random token per session, rendered
 * into every form as `_csrf` and checked on every state-changing request.
 */
function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  res.locals.csrfToken = req.session.csrfToken;

  if (SAFE_METHODS.has(req.method)) return next();

  const submitted = req.body && req.body._csrf;
  if (tokensMatch(submitted, req.session.csrfToken)) return next();

  return next(new HttpError(403, "Your form expired. Please go back, refresh the page and try again."));
}

module.exports = { csrfProtection };
