const request = require("supertest");

const Event = require("../../src/models/Event");
const User = require("../../src/models/User");

const PASSWORD = "password123";

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function createUser(overrides = {}) {
  const { password = PASSWORD, ...rest } = overrides;
  return User.create({
    name: "Test User",
    email: `user${Math.random().toString(36).slice(2, 10)}@example.com`,
    role: "user",
    ...rest,
    password: await User.hashPassword(password),
  });
}

function createEvent(overrides = {}) {
  return Event.create({
    title: "Test Conference",
    description: "A test event.",
    category: "Conference",
    location: "Johannesburg",
    startDate: daysFromNow(7),
    endDate: daysFromNow(7.25),
    totalCapacity: 100,
    price: 150,
    ...overrides,
  });
}

// Every page with a form renders the session's CSRF token; /contact always has one.
async function csrfToken(agent) {
  const res = await agent.get("/contact");
  const match = res.text.match(/name="_csrf" value="([^"]+)"/);
  if (!match) throw new Error(`No CSRF token found (status ${res.status})`);
  return match[1];
}

async function postForm(agent, url, data = {}) {
  const _csrf = await csrfToken(agent);
  return agent.post(url).type("form").send({ _csrf, ...data });
}

async function loginAs(app, user, password = PASSWORD) {
  const agent = request.agent(app);
  const res = await postForm(agent, "/login", { email: user.email, password });
  if (res.status !== 302) throw new Error(`Login failed with status ${res.status}`);
  return agent;
}

// EJS escapes apostrophes etc.; decode the few we assert on.
function text(res) {
  return res.text.replace(/&#39;/g, "'").replace(/&#34;|&quot;/g, '"').replace(/&amp;/g, "&");
}

module.exports = { PASSWORD, daysFromNow, createUser, createEvent, csrfToken, postForm, loginAs, text };
