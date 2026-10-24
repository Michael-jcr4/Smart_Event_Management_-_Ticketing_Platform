# Gatherly: Smart Event Management & Ticketing Platform

[![CI](https://github.com/Michael-jcr4/Smart_Event_Management_-_Ticketing_Platform/actions/workflows/ci.yml/badge.svg)](https://github.com/Michael-jcr4/Smart_Event_Management_-_Ticketing_Platform/actions/workflows/ci.yml)

A server-rendered web app for browsing events and booking tickets. Visitors can search and filter events, registered users book and cancel tickets, and admins manage events and handle customer enquiries.

The main backend focus is **ticket capacity that stays correct under concurrent bookings**, along with session-based authentication, role-based access control and a test suite that runs against a real MongoDB instance.

**Stack:** Node.js · Express 5 · MongoDB · Mongoose · EJS · Jest · Supertest · GitHub Actions

---

## Features

| Area | What it does |
|---|---|
| **Events** | Public listing of upcoming events with text search, category, date and availability filters |
| **Accounts** | Register, log in and log out with bcrypt-hashed passwords and server-side sessions |
| **Booking** | Book 1–10 tickets per booking, see bookings on a personal dashboard, cancel before the event starts |
| **Capacity control** | Seats can never be oversold, even when many people book the last tickets at the same moment |
| **Admin** | Create, edit and delete events; dashboard with tickets sold, revenue and open enquiries |
| **Enquiries** | Anyone can send an enquiry; admins track it through *New → In Progress → Resolved* |

## How the booking logic avoids overselling

The naive approach (read the event, check `bookedCount < totalCapacity`, then save) has a race condition: two requests can both read "1 seat left" and both book it.

Instead, the check and the increment happen in **one atomic MongoDB update** ([`src/services/bookingService.js`](src/services/bookingService.js)):

```js
Event.findOneAndUpdate(
  {
    _id: eventId,
    startDate: { $gt: now },
    $expr: { $lte: [{ $add: ["$bookedCount", qty] }, "$totalCapacity"] },
  },
  { $inc: { bookedCount: qty } },
  { returnDocument: "after" }
);
```

The filter only matches if there's room for the requested tickets, and MongoDB applies single-document updates atomically, so concurrent requests are serialised by the database itself. If nothing matches, a follow-up read works out *why* (sold out, not enough left, already started) to show a helpful message.

A test fires **20 simultaneous bookings at an event with 5 seats** and checks that exactly 5 succeed.

The same pattern is used elsewhere:

- **Cancelling** only moves a booking from `confirmed` to `cancelled` if it's still confirmed, so a double-clicked cancel button releases seats once.
- **Editing an event** can't lower capacity below the tickets already sold; the check is part of the update's filter.

**Trade-off:** a booking touches two documents (the event's counter and the new booking). Rather than a multi-document transaction, which needs a MongoDB replica set, the service uses a *compensating action*: if writing the booking fails, the reserved seats are released again.

## Security

- Passwords hashed with **bcrypt**; the hash is excluded from queries by default
- Users can't choose their role when registering; admin accounts are created with a seed script
- **Session ID regenerated on login** to prevent session fixation; cookies are `httpOnly`, `sameSite=lax` and `secure` in production
- **CSRF tokens** on every form, compared in constant time
- **Rate limiting** on login and registration
- Security headers and a Content-Security-Policy via **Helmet**; no inline scripts
- Form bodies parsed as plain strings, so requests can't inject MongoDB operators such as `{"$ne": ""}`
- User search text is regex-escaped before querying
- Login redirects only go to paths on this site (no open redirects)
- Secrets come from environment variables; `.env` is git-ignored

## Project structure

```
src/
├── app.js                  Express app setup (exported for tests)
├── server.js               Connects to MongoDB and starts the server
├── config/env.js           Environment configuration
├── models/                 Mongoose schemas: User, Event, Booking, Enquiry
├── services/               Business logic (booking and cancellation)
├── controllers/            Request handlers, one file per area
├── routes/index.js         All routes and which middleware protects them
├── middleware/             Auth guards, CSRF, rate limiting, errors, view locals
├── utils/                  Formatting helpers and HttpError
└── views/                  EJS templates
public/                     CSS and a small client-side script
scripts/seed.js             Creates an admin account and sample events
tests/                      Jest + Supertest tests against an in-memory MongoDB
```

## Getting started

**Prerequisites:** Node.js 20+ and MongoDB running locally (or a MongoDB Atlas connection string).

```bash
git clone https://github.com/Michael-jcr4/Smart_Event_Management_-_Ticketing_Platform.git
cd Smart_Event_Management_-_Ticketing_Platform
npm install

cp .env.example .env        # then fill in SESSION_SECRET and ADMIN_PASSWORD
npm run seed                # creates the admin account and sample events
npm run dev                 # http://localhost:3000
```

Log in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env` to see the admin dashboard, or register a normal account to book tickets.

## Running the tests

```bash
npm test
```

The tests start a throwaway MongoDB server in memory (the first run downloads the MongoDB binary), so nothing touches your real database. They cover registration and login, CSRF, admin access rules, the booking flow and the concurrency case above. They also run on every push and pull request through GitHub Actions.

## Routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | Public | Upcoming events with filters |
| GET | `/events/:id` | Public | Event details and booking form |
| GET/POST | `/register`, `/login` | Public | Create an account / log in |
| POST | `/logout` | Logged in | End the session |
| POST | `/events/:id/book` | Logged in | Book tickets |
| POST | `/bookings/:id/cancel` | Owner | Cancel a booking |
| GET | `/dashboard` | Logged in | My bookings, or admin stats for admins |
| GET/POST | `/contact` | Public | Send an enquiry (admins also see the inbox) |
| POST | `/contact/:id/status`, `/contact/:id/delete` | Admin | Manage enquiries |
| GET/POST | `/admin/events/...` | Admin | Create, edit and delete events |

## Project history and team

This started as a group project for the Web Programming module at Belgium Campus iTversity, where each team member built one part of the platform as a separate module:

| Team member | Original module |
|---|---|
| Lisa Verson | Home page and event listing |
| **Michael-John Robinson** | **User registration and authentication** |
| Nokutenda Madziwa | Admin event management |
| Jordan Naidoo | Contact and enquiry management |

After submission, the four modules were merged into this single application: a shared data model and session, the booking and dashboard features the team had planned, security fixes, and an automated test suite with CI.

## License

MIT
