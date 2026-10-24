// Makes the logged-in user, the current path and any one-off flash message
// available to every view.
function setLocals(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

module.exports = { setLocals, setFlash };
