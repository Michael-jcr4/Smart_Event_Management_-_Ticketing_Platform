// An error with an HTTP status and a message that is safe to show the user.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.expose = true;
  }
}

module.exports = HttpError;
