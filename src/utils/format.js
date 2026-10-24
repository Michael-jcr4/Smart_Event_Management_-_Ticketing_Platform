// View helpers, exposed to every template as `fmt`.

function date(value) {
  return new Date(value).toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function dateTime(value) {
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateRange(start, end) {
  const startDay = new Date(start).toDateString();
  const endDay = new Date(end).toDateString();
  return startDay === endDay ? dateTime(start) : `${date(start)} – ${date(end)}`;
}

function money(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

// Value for <input type="datetime-local">, in the server's local time.
function inputDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

module.exports = { date, dateTime, dateRange, money, inputDateTime };
