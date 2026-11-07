import { bearer } from './support/auth-helpers';
import { BookingWorld, createBookingWorld, statusOf } from './support/booking-world';
import { createEvent, seats } from './support/factories';

// The fixed clock reads 2026-03-10T12:00:00Z.
describe('Organizers set up events', () => {
  let w: BookingWorld;
  const valid = { name: 'Spring Concert', description: 'Strings and piano', venue: 'Town Hall', startsAt: '2026-04-01T19:00:00Z', seatRows: 10, seatsPerRow: 12 };
  const post = (body: object) => w.api().post('/api/events').set(bearer(w.organizer.token)).send(body);
  const patch = (body: object) => w.api().patch(`/api/events/${w.event.id}`).set(bearer(w.organizer.token)).send(body);
  const fieldsOf = (res: { body: { error: { details?: { fields?: object } } } }) => Object.keys(res.body.error.details?.fields ?? {});

  beforeEach(async () => {
    w = await createBookingWorld();
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-EVT-01: a valid event is saved with a full grid of available seats', async () => {
    const res = await post(valid).expect(201);
    expect(res.body).toMatchObject({
      name: 'Spring Concert',
      venue: 'Town Hall',
      startsAt: '2026-04-01T19:00:00.000Z',
      isOpen: true,
      seats: { capacity: 120, available: 120, held: 0, booked: 0 },
    });
    const map = await w.seatMap(w.attendees[0], res.body.id);
    expect(map.seats).toHaveLength(120);
    expect(map.seats[0]).toMatchObject({ label: 'A1', status: 'available', mine: false });
    expect(map.seats[119].label).toBe('J12');
  });

  it('T-EVT-02: the start time must be in the future and include a time zone', async () => {
    for (const startsAt of ['2026-03-10T12:00:00Z', '2026-03-01T19:00:00Z', '2026-04-01T19:00:00', 'next friday']) {
      const res = await post({ ...valid, startsAt }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(res)).toEqual(['startsAt']);
    }
    await post({ ...valid, startsAt: '2026-03-10T12:00:01Z' }).expect(201);
  });

  it('T-EVT-03: the grid cannot be empty or too big, and name and venue are required', async () => {
    const cases: [object, string][] = [
      [{ seatRows: 0 }, 'seatRows'],
      [{ seatsPerRow: 0 }, 'seatsPerRow'],
      [{ seatRows: 27 }, 'seatRows'],
      [{ seatsPerRow: 51 }, 'seatsPerRow'],
      [{ seatRows: 2.5 }, 'seatRows'],
      [{ name: '   ' }, 'name'],
      [{ venue: '' }, 'venue'],
    ];
    for (const [change, field] of cases) {
      const res = await post({ ...valid, ...change }).expect(400);
      expect(fieldsOf(res)).toEqual([field]);
    }
    const { seatRows: _omit, ...withoutRows } = valid;
    expect(fieldsOf(await post(withoutRows).expect(400))).toEqual(['seatRows']);
  });

  it('T-EVT-04: a grid change that would drop a held or booked seat is refused', async () => {
    await w.hold(w.attendees[0], seats('J12')).expect(201);
    const refused = await patch({ seatRows: 9 }).expect(409);
    expect(refused.body.error).toMatchObject({ reason: 'SEATS_IN_USE', details: { seats: ['J12'] } });
    await patch({ seatsPerRow: 11 }).expect(409);

    const grown = await patch({ seatRows: 12, seatsPerRow: 14, name: 'Bigger' }).expect(200);
    expect(grown.body).toMatchObject({ name: 'Bigger', seats: { capacity: 168, held: 1 } });
    expect(statusOf(await w.seatMap(w.attendees[1]), 'L14')).toBe('available');

    const shrunk = await patch({ seatRows: 10, seatsPerRow: 12 }).expect(200);
    expect(shrunk.body.seats.capacity).toBe(120);
    expect(statusOf(await w.seatMap(w.attendees[1]), 'J12')).toBe('held');
  });

  it('T-EVT-05: the list shows seat counts with upcoming events first', async () => {
    const past = await createEvent(w.t.dataSource, w.organizer.user, { name: 'Last year', startsAt: '2025-12-01T19:00:00Z' });
    const soon = await createEvent(w.t.dataSource, w.organizer.user, { name: 'Soon', startsAt: '2026-03-20T19:00:00Z', seatRows: 2, seatsPerRow: 3 });
    const hold = await w.hold(w.attendees[0], seats('A1', 'A2')).expect(201);
    await w.api().post(`/api/holds/${hold.body.id}/confirm`).set(bearer(w.attendees[0].token)).expect(200);
    await w.hold(w.attendees[1], seats('B1')).expect(201);

    const res = await w.api().get('/api/events').set(bearer(w.attendees[1].token)).expect(200);
    expect(res.body.map((e: { name: string }) => e.name)).toEqual(['Soon', w.event.name, 'Last year']);
    expect(res.body[0].seats).toEqual({ capacity: 6, available: 6, held: 0, booked: 0 });
    expect(res.body[1].seats).toEqual({ capacity: 120, available: 117, held: 1, booked: 2 });
    expect(res.body[2]).toMatchObject({ id: past.id, isOpen: false });

    const one = await w.api().get(`/api/events/${soon.id}`).set(bearer(w.attendees[0].token)).expect(200);
    expect(one.body.name).toBe('Soon');
  });
});
