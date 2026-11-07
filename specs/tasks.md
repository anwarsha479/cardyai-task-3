# Tasks: Event Seat Booking

**Input**: [spec.md](spec.md), [plan.md](plan.md)
**Tests**: Included. Each test name starts with the spec test ID it proves.

Format: `[ID] [P?] [Story] Description`. `[P]` = can run in parallel (different files).

| Label | Story |
|-------|-------|
| US1 | Sign in with a role |
| US2 | Set up events |
| US3 | Live seat map |
| US4 | Hold and confirm seats |
| US5 | No double booking |
| US6 | Holds expire on time |
| US7 | Booking history and cancellation |
| US8 | Configuration |
| US9 | Demo seed |

## Phase 1: Setup

- [x] T001 Create `task-3-event-seat-booking/` with `.env.example` (local PostgreSQL) and a local `.env`.
- [x] T002 [P] Create `backend/` (package.json scripts, tsconfig, nest-cli, Jest unit config, `test/jest-e2e.json`) and install dependencies.
- [x] T003 [P] Create `frontend/` (Vite, React, MUI, Router, `vite.config.ts` reading the task `.env`) and install dependencies.

## Phase 2: Foundational

- [x] T004 Copy the shared pieces from task 2 and adapt them: `config/env.validation.ts` (plus `HOLD_SWEEP_INTERVAL_SECONDS`), `common/` (clock, app-error with the new reason codes, filter, pipe, trim), `app-setup.ts`, `main.ts`.
- [x] T005 Write the migrations: users, settings, events, bookings, booking_seats with the partial unique indexes. List them in `database/data-source.ts`.
- [x] T006 Create the entities: `User`, `Setting`, `Event`, `Booking`, `BookingSeat`.
- [x] T007 Create the test support: `global-setup.ts`, `test-env.ts`, `test-app.ts` (fixed clock), `fixed-clock.ts`, `auth-helpers.ts`, `factories.ts`.

## Phase 3: US1 – Sign in with a role

- [x] T008 [US1] Auth module (login, me, global JWT guard, roles guard, decorators) and users service.
- [x] T009 [US1] Tests T-AUTH-01..05 in `test/auth.e2e-spec.ts`.

## Phase 4: US8 – Settings (needed by the rules)

- [x] T010 [US8] Settings module: `holdDurationMinutes`, `maxSeatsPerBooking`; GET for any role, PATCH for organizer.

## Phase 5: US2 – Events

- [x] T011 [US2] Pure rules in `bookings/utils/booking-rules.util.ts` with unit tests in `booking-rules.util.spec.ts`.
- [x] T012 [US2] Events module: create, edit (grid change refused with `SEATS_IN_USE`), list and get with seat counts.
- [x] T013 [US2] Tests T-EVT-01..05 in `test/events.e2e-spec.ts`.

## Phase 6: US3, US4, US5, US6 – Seat map, holds, concurrency, expiry 🎯 MVP

- [x] T014 [US3] Seat-updates module: change bus and `GET /events/:id/seats/stream`.
- [x] T015 [US4] `releaseExpiredHolds`, `BookingsService.hold`, `confirm`, `release` as in the plan; seat map in the events service.
- [x] T016 [US6] `HoldExpiryService` running on `HOLD_SWEEP_INTERVAL_SECONDS`.
- [x] T017 [US4] Tests T-MAP-01, T-HOLD-01..06, T-BOOK-01 in `test/holds.e2e-spec.ts`.
- [x] T018 [US3] Test T-MAP-02 in `test/seat-stream.e2e-spec.ts`.
- [x] T019 [US5] Tests T-RACE-01..04 in `test/concurrency.e2e-spec.ts`.
- [x] T020 [US6] Tests T-EXP-01..03 in `test/expiry.e2e-spec.ts`.

## Phase 7: US7 – History and cancellation

- [x] T021 [US7] `GET /bookings`, `POST /bookings/:id/cancel`.
- [x] T022 [US7] Tests T-BOOK-02..04 in `test/bookings.e2e-spec.ts`.

## Phase 8: US8 – Configuration changes behaviour

- [x] T023 [US8] Tests T-CFG-01..04 in `test/config.e2e-spec.ts`.

## Phase 9: US9 – Demo seed

- [x] T024 [US9] `seed-data.ts`, `seed.ts`, `run-seed.ts`.
- [x] T025 [US9] Tests T-SEED-01..03 in `test/seed.e2e-spec.ts`.

## Phase 10: Frontend

- [x] T026 Shell: theme, API client, auth context, login, layout with role-based navigation.
- [x] T027 [P] Events page and event form dialog (organizer).
- [x] T028 [P] Event page: seat map, selection, hold panel with countdown, live stream.
- [x] T029 [P] My bookings page with cancel; Settings page.

## Phase 11: Polish

- [x] T030 README: setup, architecture, data model, where double booking is stopped, demo accounts, tests.
- [x] T031 Run every test, build both apps, and check both roles in the browser.

## Dependencies

Phase 1 → Phase 2 → US1 → US8 settings → US2 → US3–6 → US7 → US8 tests → US9 → frontend → polish.
Inside a phase, `[P]` tasks touch different files and can be done in any order.
