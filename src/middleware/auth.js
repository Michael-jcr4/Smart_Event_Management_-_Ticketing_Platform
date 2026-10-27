const HttpError = require("../utils/httpError");

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  const nextUrl = req.method === "GET" ? `?next=${encodeURIComponent(req.originalUrl)}` : "";
  return res.redirect(`/login${nextUrl}`);
}

function requireRole(...roles){
  return(req, res, next) => {
    if(!req.session.user) return requireAuth(req, res, next);
    if(roles.includes(req.session.user.role)) return next();
    return next(new HttpError(403, "You do not have permission to do that"));
  };
}

const requireAdmin = requireRole("admin");

// Only allow redirects to paths on this site (blocks "//evil.com" style open redirects).
function safeRedirectPath(target, fallback = "/dashboard") {
  if (typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}

module.exports = { requireAuth, requireRole, requireAdmin, safeRedirectPath };
