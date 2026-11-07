import { bearer } from './support/auth-helpers';
import { BookingWorld, createBookingWorld, statusOf } from './support/booking-world';
import { createEvent, seats } from './support/factories';

// The fixed clock reads 2026-03-10T12:00:00Z; the default hold lasts 5 minutes, at most 4 seats.
describe('Attendees hold and confirm seats', () => {
  let w: BookingWorld;
  const confirm = (who: { token: string }, id: string) => w.api().post(`/api/holds/${id}/confirm`).set(bearer(who.token));

  beforeEach(async () => {
    w = await createBookingWorld();
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-MAP-01: the seat map shows held, booked and available seats, and marks your own', async () => {
    const [ann, bob] = w.attendees;
    const booked = await w.hold(ann, seats('A1')).expect(201);
    await confirm(ann, booked.body.id).expect(200);
    const held = await w.hold(bob, seats('C3', 'C4')).expect(201);

    const forBob = await w.seatMap(bob);
    expect(forBob.seats.find((s) => s.label === 'A1')).toMatchObject({ status: 'booked', mine: false });
    expect(forBob.seats.find((s) => s.label === 'C3')).toMatchObject({ status: 'held', mine: true });
    expect(forBob.seats.filter((s) => s.status === 'available')).toHaveLength(117);
    expect(forBob.myHold).toEqual({
      id: held.body.id,
      expiresAt: '2026-03-10T12:05:00.000Z',
      seats: [
        { row: 3, number: 3, label: 'C3' },
        { row: 3, number: 4, label: 'C4' },
      ],
    });
    expect(forBob).toMatchObject({ serverTime: '2026-03-10T12:00:00.000Z', maxSeatsPerBooking: 4, holdDurationMinutes: 5 });

    const forAnn = await w.seatMap(ann);
    expect(forAnn.seats.find((s) => s.label === 'A1')).toMatchObject({ status: 'booked', mine: true });
    expect(forAnn.seats.find((s) => s.label === 'C3')).toMatchObject({ status: 'held', mine: false });
    expect(forAnn.myHold).toBeNull();
  });

  it('T-HOLD-01: up to the maximum seats are held until now + hold duration', async () => {
    const res = await w.hold(w.attendees[0], seats('B4', 'B1', 'B2', 'B3')).expect(201);
    expect(res.body).toMatchObject({
      status: 'held',
      holdExpiresAt: '2026-03-10T12:05:00.000Z',
      event: { id: w.event.id, name: w.event.name },
      seats: ['B1', 'B2', 'B3', 'B4'].map((label) => expect.objectContaining({ label })),
    });
    const map = await w.seatMap(w.attendees[1]);
    expect(['B1', 'B2', 'B3', 'B4'].map((l) => statusOf(map, l))).toEqual(['held', 'held', 'held', 'held']);
  });

  it('T-HOLD-02: too many, none, duplicate or off-grid seats are refused', async () => {
    const tooMany = await w.hold(w.attendees[0], seats('A1', 'A2', 'A3', 'A4', 'A5')).expect(409);
    expect(tooMany.body.error).toMatchObject({ reason: 'SEAT_LIMIT_EXCEEDED', details: { max: 4, requested: 5 } });

    for (const body of [[], seats('A1', 'A1'), seats('K1'), seats('A13'), [{ row: 0, number: 1 }], [{ row: 1, number: 'x' }]]) {
      const res = await w.hold(w.attendees[0], body as never).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const unknown = await w.hold(w.attendees[0], seats('A1'), '00000000-0000-4000-8000-000000000000').expect(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');
    expect((await w.seatMap(w.attendees[1])).seats.every((s) => s.status === 'available')).toBe(true);
  });

  it('T-HOLD-03: a hold that includes a taken seat is refused as a whole', async () => {
    const [ann, bob] = w.attendees;
    await w.hold(ann, seats('D5')).expect(201);
    const refused = await w.hold(bob, seats('D4', 'D5', 'D6')).expect(409);
    expect(refused.body.error).toMatchObject({ reason: 'SEAT_UNAVAILABLE', details: { seats: ['D5'] } });
    const map = await w.seatMap(bob);
    expect([statusOf(map, 'D4'), statusOf(map, 'D6')]).toEqual(['available', 'available']);
    expect(map.myHold).toBeNull();
  });

  it('T-HOLD-04: one active hold per attendee per event', async () => {
    const [ann] = w.attendees;
    await w.hold(ann, seats('A1')).expect(201);
    const second = await w.hold(ann, seats('A2')).expect(409);
    expect(second.body.error.reason).toBe('HOLD_EXISTS');

    const other = await createEvent(w.t.dataSource, w.organizer.user);
    await w.hold(ann, seats('A2'), other.id).expect(201);
  });

  it('T-HOLD-05: releasing a hold frees its seats', async () => {
    const [ann, bob] = w.attendees;
    const hold = await w.hold(ann, seats('E1', 'E2')).expect(201);
    await w.api().delete(`/api/holds/${hold.body.id}`).set(bearer(ann.token)).expect(204);
    expect(statusOf(await w.seatMap(bob), 'E1')).toBe('available');
    await w.hold(bob, seats('E1', 'E2')).expect(201);

    const again = await w.api().delete(`/api/holds/${hold.body.id}`).set(bearer(ann.token)).expect(409);
    expect(again.body.error.reason).toBe('INVALID_STATE');
    await confirm(ann, hold.body.id).expect(409);
  });

  it('T-HOLD-06: holds and confirmations stop once the event has started', async () => {
    const event = await createEvent(w.t.dataSource, w.organizer.user, { startsAt: '2026-03-10T12:02:00Z' });
    const hold = await w.hold(w.attendees[0], seats('A1'), event.id).expect(201);
    w.t.clock.set('2026-03-10T12:02:00Z');
    const late = await w.hold(w.attendees[1], seats('A2'), event.id).expect(409);
    expect(late.body.error.reason).toBe('EVENT_CLOSED');
    expect((await confirm(w.attendees[0], hold.body.id).expect(409)).body.error.reason).toBe('EVENT_CLOSED');
  });

  it('T-BOOK-01: confirming a hold books its seats, once', async () => {
    const [ann, bob] = w.attendees;
    const hold = await w.hold(ann, seats('F1', 'F2')).expect(201);
    w.t.clock.set('2026-03-10T12:04:00Z');
    const booked = await confirm(ann, hold.body.id).expect(200);
    expect(booked.body).toMatchObject({ id: hold.body.id, status: 'confirmed', confirmedAt: '2026-03-10T12:04:00.000Z' });
    expect(statusOf(await w.seatMap(bob), 'F1')).toBe('booked');

    const twice = await confirm(ann, hold.body.id).expect(409);
    expect(twice.body.error).toMatchObject({ reason: 'INVALID_STATE', details: { status: 'confirmed' } });

    w.t.clock.set('2026-03-10T13:00:00Z');
    expect(statusOf(await w.seatMap(bob), 'F1')).toBe('booked');
    await w.hold(ann, seats('F3')).expect(201);
  });
});
