const path = require("path");

const express = require("express");
const session = require("express-session");
const helmet = require("helmet");

const config = require("./config/env");
const { csrfProtection } = require("./middleware/csrf");
const { notFound, errorHandler } = require("./middleware/errors");
const { setLocals } = require("./middleware/locals");
const routes = require("./routes");
const format = require("./utils/format");

/**
 * Builds the Express app. The session store is injected so the server can use
 * MongoDB-backed sessions while tests use the default in-memory store.
 */
function createApp({ sessionStore } = {}) {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.locals.fmt = format;

  if (config.isProduction) {
    // Needed for secure cookies when running behind a reverse proxy (Render, Railway, etc.).
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  // extended: false keeps form values as plain strings, so a request can't
  // smuggle MongoDB operators like {"$ne": ""} into a query.
  app.use(express.urlencoded({ extended: false, limit: "20kb" }));
  app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: config.isProduction ? "7d" : 0 }));

  app.use(
    session({
      name: "sid",
      secret: config.sessionSecret,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProduction,
        maxAge: 8 * 60 * 60 * 1000,
      },
    })
  );

  app.use(setLocals);
  app.use(csrfProtection);

  app.use(routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
