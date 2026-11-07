# Implementation Plan: Event Seat Booking

**Date**: 2026-11-04 | **Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md)

## Summary

A NestJS API and a React SPA backed by PostgreSQL. The double-booking rule lives in the database:
a partial unique index allows one active claim per seat, and every hold writes its claims through
it inside one transaction. Holds expire at an exact instant. Reads treat a hold as gone from that
instant, new holds release expired holds first, and a background job marks them expired and
notifies a Server-Sent Events stream that drives the live seat map. Configuration lives in the
database and is read on every hold.

The structure, error envelope, auth guards, clock, settings service and test harness follow tasks 1
and 2, so the three projects work the same way.

## Technical Context

| Item | Decision |
|------|----------|
| Language | TypeScript (strict) for backend and frontend |
| Runtime | Node.js 22 LTS |
| Backend | NestJS 11, TypeORM 0.3, `pg`, `@nestjs/jwt`, `bcryptjs`, `class-validator`, `@nestjs/swagger` |
| Database | PostgreSQL 16+ installed locally (developed on 17). Schema only through migrations (`synchronize: false`). |
| Live updates | Server-Sent Events (`@Sse`), read in the browser with `fetch` so the bearer token goes in a header, not the URL |
| Frontend | React 18, Vite, Material UI 7, React Router 6 |
| Tests | Jest + Supertest. Unit tests for the pure rules; e2e tests against a separate test database with a fixed clock. |
| Config | One `.env` in the task folder, validated at startup. No hard-coded hosts, ports or secrets. |
| Ports | DB 5432 (local server), API 3040, web 5176 (tasks 1 and 2 use 3020/5174 and 3030/5175). |

## Quality Gates

| Gate | Check |
|------|-------|
| G1 | Every role and rule is enforced on the server (SB-01). |
| G2 | No seat can have two active claims, whatever the caller does (SB-05, SB-DM-3). |
| G3 | Every rule reads configuration when it runs, never at startup (SB-DM-4). |
| G4 | Every spec test ID has a passing test (SC-01). |
| G5 | No environment values in code; all in `.env.example` and the env schema. |

## Project Structure

```text
task-3-event-seat-booking/
├── .env.example   README.md
├── specs/               spec.md, plan.md, tasks.md
├── backend/
│   ├── src/
│   │   ├── main.ts  app.module.ts  app-setup.ts
│   │   ├── config/env.validation.ts
│   │   ├── common/          clock/, exceptions/app-error.ts, filters/, pipes/, decorators/trim, utils/calendar.util.ts
│   │   ├── database/        data-source.ts, migrations/, seeds/ (seed-data.ts, seed.ts, run-seed.ts)
│   │   ├── auth/            login, me, JWT + roles guards
│   │   ├── users/           User entity and lookups
│   │   ├── settings/        holdDurationMinutes, maxSeatsPerBooking
│   │   ├── seat-updates/    in-process change bus + SSE stream endpoint
│   │   ├── events/          create, edit, list, seat map
│   │   └── bookings/        hold, confirm, release, history, cancel; hold-expiry.service.ts
│   │       ├── seat-claims.ts   occupied seats, counts, releaseExpiredHolds (used by events too)
│   │       └── utils/booking-rules.util.ts (+ .spec.ts)   all pure rules
│   └── test/                *.e2e-spec.ts, support/ (test app, factories, fixed clock, booking world)
└── frontend/src/
    ├── api/  auth/  layout/  components/  theme.ts
    ├── events/     EventsPage, EventDetailPage, EventFormDialog, SeatMap, HoldPanel, useSeatStream, format
    ├── bookings/   MyBookingsPage
    └── settings/   SettingsPage
```

## Data Model

```text
users          id uuid PK, email unique (lower-case), name, password_hash,
               role user_role ('attendee','organizer'), created_at
settings       key PK, value int, updated_by FK users NULL, updated_at
events         id uuid PK, name varchar(120), description varchar(2000) NULL, venue varchar(120),
               starts_at timestamptz, seat_rows smallint CHECK 1..26, seats_per_row smallint CHECK 1..50,
               created_by FK users, created_at, updated_at
bookings       id uuid PK, event_id FK events, attendee_id FK users,
               status booking_status ('held','confirmed','expired','cancelled'),
               hold_expires_at timestamptz, confirmed_at NULL, cancelled_at NULL, created_at, updated_at
               UNIQUE (id, event_id)
               CHECK status <> 'confirmed' OR confirmed_at IS NOT NULL
               CHECK status <> 'cancelled' OR cancelled_at IS NOT NULL
               UNIQUE INDEX ux_bookings_one_active_hold (event_id, attendee_id) WHERE status = 'held'
booking_seats  booking_id, event_id, seat_row smallint CHECK >= 1, seat_number smallint CHECK >= 1,
               released_at timestamptz NULL
               PK (booking_id, seat_row, seat_number)
               FK (booking_id, event_id) -> bookings (id, event_id) ON DELETE CASCADE
               UNIQUE INDEX ux_booking_seats_active_seat (event_id, seat_row, seat_number)
                 WHERE released_at IS NULL
```

Seats are not rows of their own: a seat is `(event, row, number)` inside the event's grid. A claim
is *active* while `released_at` is null. The composite foreign key makes the copied `event_id`
match its booking, so the unique index really is per event.

## Where double booking is stopped

1. **Database (the guarantee).** `ux_booking_seats_active_seat` refuses a second active claim on a
   seat. PostgreSQL checks it on every insert, from every connection. If two transactions insert
   the same seat, the second waits for the first. It then fails if the first commits, or goes ahead
   if the first rolls back. No code path can write a claim without passing this check.
2. **Service (friendly errors).** `BookingsService.hold` checks the seats first so it can name the
   taken ones. Two requests can both pass this check at the same moment. The index then refuses
   one of them, and the service turns the `23505` error into `SEAT_UNAVAILABLE`.
3. **Interface (convenience only).** The seat map disables seats that are not available. Nothing
   depends on it.

All of a hold's claims go in one transaction, so a hold is all or nothing. Claims are inserted in
seat order, so two holds that overlap on several seats cannot deadlock.

## Hold transaction (`BookingsService.hold`)

1. Lock the event `FOR SHARE`. Concurrent holds still run, but a grid change waits.
2. Check that the event has not started (`EVENT_CLOSED`) and the seat selection: count, duplicates, inside grid (`checkSeatSelection`).
3. Read the settings.
4. `releaseExpiredHolds(manager, now, eventId)`: lock expired held bookings `ORDER BY id FOR UPDATE`, set `expired`, set `released_at = hold_expires_at` on their claims.
5. Pre-checks: attendee has no active hold (`HOLD_EXISTS`); none of the seats has an active claim (`SEAT_UNAVAILABLE`).
6. Insert the booking (`held`, `hold_expires_at = now + holdDurationMinutes`) and its claims, sorted.
7. Commit, then publish a change for the event.

Unique violations map to rule errors: `ux_booking_seats_active_seat` → `SEAT_UNAVAILABLE` (the
service then lists the seats that are now taken), `ux_bookings_one_active_hold` → `HOLD_EXISTS`.

**Confirm**: lock the booking `FOR UPDATE` → owner → `held` (`expired` gives `HOLD_EXPIRED`, others
`INVALID_STATE`) → `now < hold_expires_at` (`HOLD_EXPIRED`) → event not started → set `confirmed`.
**Release** (held) and **cancel** (confirmed, before start): lock the booking, set `cancelled`,
set `released_at = now` on its claims.
**Grid change**: lock the event `FOR UPDATE`, release expired holds, refuse with `SEATS_IN_USE` if an
active claim falls outside the new grid.

## Expiry

- `isHoldExpired(expiresAt, now)` is `now >= expiresAt`. Seat-map reads count a held claim only while `hold_expires_at > now`, so a seat is free from the exact expiry instant whether or not the job has run.
- `HoldExpiryService` runs `releaseExpiredHolds(manager, now)` every `HOLD_SWEEP_INTERVAL_SECONDS` (env; `0` turns it off, as the e2e tests do and call it directly with the fixed clock). It publishes a change for each event it touched.
- The released time is the hold's `hold_expires_at`, so the record shows the release happened on time, not when the job ran.

## Live seat map

`SeatUpdatesService` is an RxJS `Subject<{ eventId }>`. Bookings publish after each commit. The
stream endpoint `GET /events/:id/seats/stream` sends `ready` on connect, `changed` for that event,
and `ping` every 25 seconds. The client reloads `GET /events/:id/seats` on `ready` and `changed`,
and reconnects after 2 seconds if the stream drops. The seat map response includes `serverTime`, so
the hold countdown corrects for a wrong client clock.

## API

All routes under `/api`. Swagger UI at `/api/docs`.

| Method & path | Roles | Purpose |
|---------------|-------|---------|
| POST /auth/login, GET /auth/me | public / any | Sign in, current user |
| GET /events | any | Events with seat counts, upcoming first |
| GET /events/:id | any | One event with seat counts |
| POST /events, PATCH /events/:id | organizer | Create, edit (including the grid) |
| GET /events/:id/seats | any | Seat map, `myHold`, `serverTime` |
| GET /events/:id/seats/stream | any | SSE change stream |
| POST /events/:id/holds | attendee | Hold seats `{ seats: [{ row, number }] }` |
| POST /holds/:id/confirm | attendee (owner) | Book the held seats |
| DELETE /holds/:id | attendee (owner) | Release a hold |
| GET /bookings | attendee | Own booking history |
| POST /bookings/:id/cancel | attendee (owner) | Cancel a confirmed booking |
| GET /settings, PATCH /settings | any / organizer | Read, change settings |

## Rules (`bookings/utils/booking-rules.util.ts`)

| Function | Rule | Error |
|----------|------|-------|
| `seatLabel(row, number)` | `1, 7` → `A7` | – |
| `checkSeatSelection(seats, grid, max)` | 1..max seats, no duplicates, inside the grid | `VALIDATION_ERROR`, `SEAT_LIMIT_EXCEEDED` |
| `seatsOutsideGrid(seats, grid)` | Claims a smaller grid would drop | used for `SEATS_IN_USE` |
| `holdExpiresAt(now, minutes)` | now + minutes | – |
| `isHoldExpired(expiresAt, now)` | now ≥ expiresAt | `HOLD_EXPIRED` |
| `assertEventOpen(startsAt, now)` | now < startsAt | `EVENT_CLOSED` |

## Settings

The task 1 and 2 `SettingsService` pattern: definitions with default, min and max in
`settings.constants.ts` (`holdDurationMinutes` 5, 1–60; `maxSeatsPerBooking` 4, 1–10); values read
from the table on every call; an update validates and saves the whole change in one transaction.

## Seed

`seed-data.ts` holds the accounts, the two events (start offset in days, grid) and 30 bookings as
(attendee, event, seat labels, status). Events start at 19:00 in the seeding machine's time zone. `seed.ts` checks each booking with `checkSeatSelection` and
checks that no two active bookings share a seat. It writes everything in one transaction, so the
unique index checks it again. It does nothing if the organizer account already exists.

## Frontend

The `api` client and auth context follow task 1; the look is its own ("Seatwise": ink primary buttons, teal accent, Plus Jakarta Sans, dark top bar). Role-based navigation:

- **Attendee**: Events (ticket-style cards with availability), Event page (seat map with a booking sidebar: selection, hold countdown, confirm and release), My tickets (upcoming and history, with cancel).
- **Organizer**: Events, Event page (read-only map with counts, edit dialog), New event dialog, Settings.

## Complexity Tracking

None. No gate is broken.
