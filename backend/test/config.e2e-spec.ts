import { HoldExpiryService } from '../src/bookings/hold-expiry.service';
import { bearer } from './support/auth-helpers';
import { BookingWorld, createBookingWorld, statusOf } from './support/booking-world';
import { resetSettings, seats } from './support/factories';

describe('Organizer configuration changes behaviour without a code change', () => {
  let w: BookingWorld;
  const values = (body: { settings: { key: string; value: number }[] }) => Object.fromEntries(body.settings.map((s) => [s.key, s.value]));
  const setSettings = (body: object) => w.api().patch('/api/settings').set(bearer(w.organizer.token)).send(body).expect(200);

  beforeEach(async () => {
    w = await createBookingWorld();
    await resetSettings(w.t.dataSource);
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-CFG-01: defaults apply on a fresh install; a change is saved with who and when', async () => {
    const fresh = await w.api().get('/api/settings').set(bearer(w.attendees[0].token)).expect(200);
    expect(values(fresh.body)).toEqual({ holdDurationMinutes: 5, maxSeatsPerBooking: 4 });

    await setSettings({ maxSeatsPerBooking: 6 });
    const after = await w.api().get('/api/settings').set(bearer(w.organizer.token)).expect(200);
    expect(after.body.settings.find((s: { key: string }) => s.key === 'maxSeatsPerBooking')).toMatchObject({
      value: 6,
      defaultValue: 4,
      min: 1,
      max: 10,
      updatedBy: { id: w.organizer.user.id, name: w.organizer.user.name },
      updatedAt: '2026-03-10T12:00:00.000Z',
    });
  });

  it('T-CFG-02: invalid values are refused and nothing changes', async () => {
    const bad: object[] = [
      { holdDurationMinutes: 0 },
      { holdDurationMinutes: 61 },
      { maxSeatsPerBooking: 0 },
      { maxSeatsPerBooking: 11 },
      { maxSeatsPerBooking: 2.5 },
      { maxSeatsPerBooking: '3' },
      { maxSeatsPerBooking: 3, colour: 'blue' },
      {},
    ];
    for (const body of bad) {
      const res = await w.api().patch('/api/settings').set(bearer(w.organizer.token)).send(body).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const res = await w.api().get('/api/settings').set(bearer(w.organizer.token)).expect(200);
    expect(values(res.body)).toEqual({ holdDurationMinutes: 5, maxSeatsPerBooking: 4 });
  });

  it('T-CFG-03: changing the maximum seats changes how many can be held', async () => {
    const [ann, bob] = w.attendees;
    await setSettings({ maxSeatsPerBooking: 2 });
    const refused = await w.hold(ann, seats('A1', 'A2', 'A3')).expect(409);
    expect(refused.body.error).toMatchObject({ reason: 'SEAT_LIMIT_EXCEEDED', details: { max: 2, requested: 3 } });
    expect((await w.seatMap(ann)).seats.length).toBe(120);

    await setSettings({ maxSeatsPerBooking: 6 });
    await w.hold(bob, seats('B1', 'B2', 'B3', 'B4', 'B5', 'B6')).expect(201);
  });

  it('T-CFG-04: changing the hold duration changes when the next hold expires', async () => {
    const [ann, bob] = w.attendees;
    const before = await w.hold(ann, seats('C1')).expect(201);
    expect(before.body.holdExpiresAt).toBe('2026-03-10T12:05:00.000Z');

    await setSettings({ holdDurationMinutes: 10 });
    const after = await w.hold(bob, seats('C2')).expect(201);
    expect(after.body.holdExpiresAt).toBe('2026-03-10T12:10:00.000Z');

    w.t.clock.set('2026-03-10T12:07:00Z');
    expect(await w.t.app.get(HoldExpiryService).releaseExpired()).toEqual([w.event.id]);
    const map = await w.seatMap(w.attendees[0]);
    expect([statusOf(map, 'C1'), statusOf(map, 'C2')]).toEqual(['available', 'held']);
  });
});
