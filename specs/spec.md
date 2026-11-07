# Feature Specification: Event Seat Booking with Double-Booking Prevention

**Created**: 2026-11-04
**Status**: Approved for build
**Input**: `3-Project-Event-Seat-Booking.pdf` (SB) and the common guidelines (CG), as followed by tasks 1 and 2

This is the single spec for task 3. The technical design is in [plan.md](plan.md) and the build
steps are in [tasks.md](tasks.md). Test IDs (`T-XXX-nn`) appear at the start of the name of the
automated test that proves them.

## Source Requirements

| ID | Requirement (paraphrased from the PDF) |
|----|-----------------------------------------|
| SB-01 | Two roles, attendee and organizer, enforced on the server. Only organizers create events, change seating or change configuration. |
| SB-02 | Event setup form: name, date, venue and a seating grid (for example 10 rows of 12 seats). The date must be in the future and the grid must not be empty. |
| SB-03 | Seat map showing available, held and booked seats, refreshing so an attendee sees changes made by others. |
| SB-04 | Booking flow: an attendee selects seats up to the configured maximum (default 4). The seats are held for the configured hold duration (default 5 minutes). Confirming the hold books them. |
| SB-05 | Double-booking prevention enforced at the storage level, not only in the interface. A test runs two competing bookings for the same seat and confirms only one succeeds. |
| SB-06 | Expired holds are released automatically. A test uses a fixed clock to prove the release happens on time. |
| SB-07 | Booking history page for each attendee, with cancellation that frees the seats. |
| SB-08 | Admin-configurable values used in the business logic: at least the hold duration and the maximum seats per booking. |
| SB-09 | Seed data: two events, one with 120 seats and one with 60, and 30 sample bookings. |
| SB-DM-1 | Done means: the concurrency test passes reliably. |
| SB-DM-2 | Done means: expired holds release on time. |
| SB-DM-3 | Done means: it is clear where the double-booking check is enforced and why the interface cannot bypass it. |
| SB-DM-4 | Done means: changing a configured value changes behaviour without a code change. |
| CG-1 | Full TypeScript stack; NestJS and PostgreSQL preferred. |
| CG-2 | Runnable from the README on a clean machine. |
| CG-3 | README covers setup, architecture, data model and how to run the tests. |
| CG-4 | At least ten automated tests. |

## User Scenarios & Testing

### User Story 1 – Sign in with a role (Priority: P1)

Everyone signs in with email and password. The server takes the role from the token and checks it
on every request, whatever the UI shows.

**Acceptance Scenarios**:

1. **Given** a seeded account, **When** the user signs in with the right password, **Then** they get a token, their name and role; a wrong password or unknown email gets 401 with the same message. (T-AUTH-01)
2. **Given** no token or an invalid token, **When** any endpoint other than login is called, including the seat stream, **Then** the answer is 401. (T-AUTH-02)
3. **Given** an attendee, **When** they create or edit an event or change settings, **Then** the answer is 403. (T-AUTH-03)
4. **Given** an organizer, **When** they hold seats, confirm a hold or cancel a booking, **Then** the answer is 403. (T-AUTH-04)
5. **Given** another attendee's hold or booking, **When** an attendee confirms, releases or cancels it, **Then** the answer is 403. (T-AUTH-05)

### User Story 2 – Set up events (Priority: P1)

An organizer creates an event with a name, optional description, venue, start date and time, and a
seating grid of rows (A–Z) by seats per row. They can later change any of these. A change to the
grid that would remove a seat that is held or booked is refused.

**Acceptance Scenarios**:

1. **Given** valid details and a 10 × 12 grid, **When** the organizer creates the event, **Then** it is saved and its seat map has 120 available seats labelled A1 to J12. (T-EVT-01)
2. **Given** a start time that is now or in the past, **When** the event is saved, **Then** it is refused with a validation error on `startsAt`. (T-EVT-02)
3. **Given** 0 rows, 0 seats per row, more than 26 rows or more than 50 seats per row, or an empty name or venue, **When** the event is saved, **Then** it is refused with a validation error on that field. (T-EVT-03)
4. **Given** an event with a booked seat in row J, **When** the organizer shrinks the grid to 9 rows, **Then** it is refused with `SEATS_IN_USE` naming the seat; growing the grid, or shrinking over free seats, is accepted. (T-EVT-04)
5. **Given** events, **When** anyone lists them, **Then** each shows its total, available, held and booked seat counts, and upcoming events come first. (T-EVT-05)

### User Story 3 – Live seat map (Priority: P1)

Anyone signed in can open an event's seat map. Each seat is **available**, **held** or **booked**,
and the attendee's own held or booked seats are marked as theirs. The page listens to a server
stream and reloads the map whenever a seat on that event changes, so changes made by others show
up within a second or two without reloading the page.

**Acceptance Scenarios**:

1. **Given** one held and one booked seat, **When** the map is read, **Then** those seats show held and booked, every other seat shows available, and the holder sees `mine` on their seats and their hold with its expiry time. (T-MAP-01)
2. **Given** an attendee listening to the stream, **When** another attendee holds, releases, confirms or cancels seats on that event, or a hold expires, **Then** the stream sends a change message for that event; changes to other events send nothing. (T-MAP-02)

### User Story 4 – Hold and confirm seats (Priority: P1) 🎯 MVP

An attendee selects seats and holds them. A hold lasts `holdDurationMinutes` from the moment it is
created. Within that time the attendee confirms the hold, which books the seats, or releases it. An
attendee has at most one active hold per event.

**Acceptance Scenarios**:

1. **Given** free seats, **When** an attendee holds up to `maxSeatsPerBooking` of them, **Then** the hold is saved with `expiresAt` = now + hold duration and the seats show as held. (T-HOLD-01)
2. **Given** more seats than the maximum, an empty list, the same seat twice, or a seat outside the grid, **When** the attendee holds them, **Then** it is refused (`SEAT_LIMIT_EXCEEDED` for too many, a validation error for the others). (T-HOLD-02)
3. **Given** a seat that is held by someone else or booked, **When** an attendee includes it in a hold, **Then** the whole hold is refused with `SEAT_UNAVAILABLE` naming the seats, and none of the requested seats are held. (T-HOLD-03)
4. **Given** an active hold on an event, **When** the same attendee holds more seats on that event, **Then** it is refused with `HOLD_EXISTS`. (T-HOLD-04)
5. **Given** an active hold, **When** the attendee releases it, **Then** the seats are available again. (T-HOLD-05)
6. **Given** an event that has started, **When** an attendee holds or confirms seats, **Then** it is refused with `EVENT_CLOSED`. (T-HOLD-06)
7. **Given** an active hold, **When** the attendee confirms it, **Then** it becomes a confirmed booking and its seats show as booked. Confirming it again is refused with `INVALID_STATE`. (T-BOOK-01)

### User Story 5 – No double booking (Priority: P1)

Two people can never hold or book the same seat, even when they click at the same moment. The rule
is enforced by the database, so no client and no code path that skips the service checks can break it.

**Acceptance Scenarios**:

1. **Given** two attendees, **When** they hold the same seat at the same moment, **Then** exactly one succeeds and the other gets `SEAT_UNAVAILABLE`. This is repeated 25 times in one test. (T-RACE-01)
2. **Given** ten attendees, **When** they all hold the same seat at once, **Then** exactly one succeeds. (T-RACE-02)
3. **Given** two attendees holding A1+A2 and A2+A3 at once, **When** both requests finish, **Then** one hold has both its seats and the other has none: a hold is all or nothing. (T-RACE-03)
4. **Given** an active claim on a seat, **When** a second claim for the same seat is written straight to the database, bypassing the API, **Then** the database refuses it. (T-RACE-04)

### User Story 6 – Holds expire on time (Priority: P1)

A hold that is not confirmed in time expires at exactly `expiresAt`. From that instant its seats
count as free for every read and every new hold, and the hold can no longer be confirmed. A
background job also marks expired holds as `expired`, records the release, and tells the seat-map
stream.

**Acceptance Scenarios**:

1. **Given** a hold made at 12:00:00 with a 5-minute duration, **When** another attendee tries the same seat at 12:04:59, **Then** it is refused; at 12:05:00 the seat shows available and the other attendee can hold it. (T-EXP-01)
2. **Given** that hold, **When** the expiry job runs at 12:04:59, **Then** nothing changes; when it runs at 12:05:00, the hold is `expired` and its seats are released at 12:05:00. (T-EXP-02)
3. **Given** an expired hold, **When** its owner confirms it, **Then** it is refused with `HOLD_EXPIRED`. (T-EXP-03)

### User Story 7 – Booking history and cancellation (Priority: P1)

Each attendee has a history of their bookings, newest first: the event, seats, status and dates. An
attendee can cancel a confirmed booking before the event starts, which frees the seats at once.

**Acceptance Scenarios**:

1. **Given** bookings by two attendees, **When** one lists their history, **Then** they see only their own, newest first, with event name, date and seat labels. (T-BOOK-02)
2. **Given** a confirmed booking, **When** the attendee cancels it, **Then** it is `cancelled` and another attendee can hold the same seats straight away. (T-BOOK-03)
3. **Given** a cancelled booking, or an event that has started, **When** the attendee cancels, **Then** it is refused (`INVALID_STATE` or `EVENT_CLOSED`). (T-BOOK-04)

### User Story 8 – Configuration (Priority: P1)

An organizer sets **holdDurationMinutes** (1–60, default 5) and **maxSeatsPerBooking** (1–10,
default 4). Values are read when each hold is made, so a change applies to the next hold with no
restart. Existing holds keep the expiry they were given.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** settings are read, **Then** the defaults apply; a change is saved with who made it and when. (T-CFG-01)
2. **Given** an out-of-range, non-integer or unknown setting, **When** it is saved, **Then** it is refused and nothing changes. (T-CFG-02)
3. **Given** `maxSeatsPerBooking` lowered to 2, **When** an attendee holds 3 seats, **Then** it is refused; raised to 6, a 6-seat hold is accepted. (T-CFG-03)
4. **Given** `holdDurationMinutes` changed to 10, **When** an attendee holds seats, **Then** the hold expires 10 minutes later, while a hold made before the change still expires 5 minutes after it was made. (T-CFG-04)

### User Story 9 – Demo seed (Priority: P2)

`npm run seed` loads 1 organizer, 12 attendees, two upcoming events (10 × 12 = 120 seats and
6 × 10 = 60 seats) and 30 bookings (confirmed and cancelled). Running it again does nothing.

**Acceptance Scenarios**:

1. **Given** an empty database, **When** the seed runs, **Then** the counts match. (T-SEED-01)
2. **Given** the seeded data, **When** the rules are checked, **Then** no seat has two active claims and no booking has more than the default maximum of seats. (T-SEED-02)
3. **Given** a seeded database, **When** the seed runs again, **Then** nothing is added. (T-SEED-03)

### Edge Cases

- Seat labels are a row letter and a seat number, e.g. `C7`. Rows run A–Z, so a grid has at most 26 rows.
- A hold at the exact `expiresAt` instant is already expired.
- Holding seats first frees any expired holds on that event, so an expired hold never blocks a seat, even if the background job has not run yet.
- Lowering `maxSeatsPerBooking` does not change existing holds or bookings.
- An organizer cannot book seats, and an attendee cannot change events.
- Event times are stored as instants (`timestamptz`) and shown in the viewer's local time.

## Requirements

### Functional Requirements

- **FR-01** Roles are `attendee` and `organizer`. Every endpoint except login needs a valid token, and the role comes from the token. (SB-01)
- **FR-02** Only organizers create and edit events and change settings. Only attendees hold, confirm, release and cancel, and only their own. (SB-01)
- **FR-03** Event: name 1–120 characters, description up to 2000, venue 1–120, `startsAt` after now, rows 1–26, seats per row 1–50. (SB-02)
- **FR-04** Seat status is calculated when it is read: **booked** if a confirmed booking claims it, **held** if a hold that has not expired claims it, otherwise **available**. (SB-03)
- **FR-05** The seat-map stream sends a message whenever a seat on that event changes. (SB-03)
- **FR-06** A hold has 1 to `maxSeatsPerBooking` distinct seats inside the grid, expires `holdDurationMinutes` after it is made, and is all or nothing. One active hold per attendee per event. (SB-04)
- **FR-07** A partial unique index allows only one active claim per seat. Every hold goes through it, so two holds on one seat cannot both be saved. (SB-05)
- **FR-08** A hold is expired once now ≥ `expiresAt`. Expired holds are released by every hold on that event and by a background job. (SB-06)
- **FR-09** Booking history per attendee; cancelling a confirmed booking before the event starts releases its seats. (SB-07)
- **FR-10** Organizers set `holdDurationMinutes` and `maxSeatsPerBooking`; the rules read them each time they run. (SB-08, SB-DM-4)
- **FR-11** Errors use `{ error: { code, reason?, message, details? } }`. Rule failures are 409 `RULE_VIOLATION` with a `reason`. (CG-3)
- **FR-12** Seed data as described in User Story 9. (SB-09)

### Key Entities

- **User**: name, email, password hash, role.
- **Event**: name, description, venue, start time, rows, seats per row, created by.
- **Booking**: event, attendee, status (`held`, `confirmed`, `expired`, `cancelled`), hold expiry, confirmed and cancelled times. A hold is a booking in status `held`.
- **BookingSeat**: one seat (row, number) claimed by a booking, with the time it was released.
- **Setting**: key, value, last changed by and when.

## Success Criteria

- **SC-01** Every test ID above is covered by a passing automated test (at least ten tests, CG-4). Unit tests `T-UNIT-01..07` cover the pure seat rules.
- **SC-02** Each "Done means" item has its own test: concurrency (T-RACE-*), on-time release (T-EXP-*), storage-level enforcement (T-RACE-04) and configuration (T-CFG-03, T-CFG-04).
- **SC-03** A clean machine with Node.js 22 and PostgreSQL runs the app from the README.

## Assumptions

- **A-01** "Admin-configurable" means the organizer role: the brief gives organizers the right to change configuration and names no third role.
- **A-02** Any organizer can manage any event. Organizers work as one team.
- **A-03** The maximum applies to each hold, and so to each booking. An attendee may make several bookings for one event, one after another.
- **A-04** A released hold is stored as `cancelled`, the same as a cancelled booking. The history shows confirmed and cancelled bookings and expired holds.
- **A-05** Seat changes are pushed by one API process. Running several API processes would need a shared channel such as PostgreSQL `LISTEN/NOTIFY`.
- **A-06** No sign-up, password reset or user management screens. Accounts come from the seed.
- **A-07** Payment is out of scope. Confirming a hold books the seats.
- **A-08** AI features are optional extras and are not part of this build.
