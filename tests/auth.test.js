const request = require("supertest");

const { createApp } = require("../src/app");
const User = require("../src/models/User");
const db = require("./helpers/db");
const { PASSWORD, createUser, postForm, loginAs, text } = require("./helpers/fixtures");

let app;

beforeAll(async () => {
  await db.connect();
  app = createApp();
});
afterEach(db.clear);
afterAll(db.close);

const validRegistration = {
  name: "Thandi Mokoena",
  email: "Thandi@Example.com",
  password: PASSWORD,
  confirmPassword: PASSWORD,
};

describe("registration", () => {
  test("creates a regular user with a hashed password and logs them in", async () => {
    const agent = request.agent(app);
    const res = await postForm(agent, "/register", validRegistration);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/dashboard");

    const user = await User.findOne({ email: "thandi@example.com" }).select("+password");
    expect(user.role).toBe("user");
    expect(user.password).not.toBe(PASSWORD);
    expect(user.password).toMatch(/^\$2[aby]\$/);

    const dashboard = await agent.get("/dashboard");
    expect(dashboard.status).toBe(200);
    expect(dashboard.text).toContain("Thandi Mokoena");
  });

  test("ignores a role sent with the form, so users can't make themselves admin", async () => {
    const agent = request.agent(app);
    await postForm(agent, "/register", { ...validRegistration, role: "admin" });

    const user = await User.findOne({ email: "thandi@example.com" });
    expect(user.role).toBe("user");
    expect((await agent.get("/admin/events")).status).toBe(403);
  });

  test("lets people sign up as an organiser", async () => {
    await postForm(request.agent(app), "/register", {...validRegistration, accountType: "organiser"});

    const user = await User.findOne({email: "thandi@example.com"});
    expect(user.role).toBe("organiser")
  });

  test("never lets people sign up as an admin", async () => {
    await postForm(request.agent(app), "/register", {...validRegistration, accountType: "admin"});

    const user = await User.findOne({email: "thandi@example.com"});
    expect(user.role).toBe("user");
  })

  test("rejects a duplicate email", async () => {
    await createUser({ email: "thandi@example.com" });
    const res = await postForm(request.agent(app), "/register", validRegistration);

    expect(res.status).toBe(400);
    expect(text(res)).toContain("An account with that email already exists.");
    expect(await User.countDocuments()).toBe(1);
  });

  test("rejects mismatched passwords and short passwords", async () => {
    const res = await postForm(request.agent(app), "/register", {
      ...validRegistration,
      password: "short",
      confirmPassword: "different",
    });

    expect(res.status).toBe(400);
    expect(text(res)).toContain("Password must be at least 8 characters long.");
    expect(text(res)).toContain("Passwords do not match.");
    expect(await User.countDocuments()).toBe(0);
  });
});

describe("login", () => {
  test("gives the same error for a wrong password and an unknown email", async () => {
    const user = await createUser();

    const wrongPassword = await postForm(request.agent(app), "/login", { email: user.email, password: "wrong-password" });
    const unknownEmail = await postForm(request.agent(app), "/login", { email: "nobody@example.com", password: PASSWORD });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(text(res)).toContain("Invalid email or password.");
    }
  });

  test("issues a new session id on login (prevents session fixation)", async () => {
    const user = await createUser();
    const agent = request.agent(app);

    const before = await agent.get("/contact");
    const sidBefore = before.headers["set-cookie"].find((c) => c.startsWith("sid="));

    const res = await postForm(agent, "/login", { email: user.email, password: PASSWORD });
    const sidAfter = res.headers["set-cookie"].find((c) => c.startsWith("sid="));

    expect(sidAfter).toBeDefined();
    expect(sidAfter.split(";")[0]).not.toBe(sidBefore.split(";")[0]);
  });

  test("redirects to a local `next` path but not to another site", async () => {
    const user = await createUser();

    const local = await postForm(request.agent(app), "/login", { email: user.email, password: PASSWORD, next: "/contact" });
    expect(local.headers.location).toBe("/contact");

    const external = await postForm(request.agent(app), "/login", { email: user.email, password: PASSWORD, next: "//evil.example.com" });
    expect(external.headers.location).toBe("/dashboard");
  });

  test("logout ends the session", async () => {
    const agent = await loginAs(app, await createUser());

    const res = await postForm(agent, "/logout");
    expect(res.status).toBe(302);

    const dashboard = await agent.get("/dashboard");
    expect(dashboard.status).toBe(302);
    expect(dashboard.headers.location).toMatch(/^\/login/);
  });
});

describe("CSRF protection", () => {
  test("rejects form posts without a valid token", async () => {
    const agent = request.agent(app);
    await agent.get("/contact");

    const missing = await agent.post("/login").type("form").send({ email: "a@example.com", password: PASSWORD });
    const forged = await agent.post("/login").type("form").send({ _csrf: "forged", email: "a@example.com", password: PASSWORD });

    expect(missing.status).toBe(403);
    expect(forged.status).toBe(403);
  });
});
