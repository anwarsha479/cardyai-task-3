import { HoldExpiryService } from '../src/bookings/hold-expiry.service';
import { bearer } from './support/auth-helpers';
import { BookingWorld, createBookingWorld, statusOf } from './support/booking-world';
import { seats } from './support/factories';

// A hold made at 12:00:00 with the default 5-minute duration expires at exactly 12:05:00.
describe('Expired holds are released on time (fixed clock)', () => {
  let w: BookingWorld;
  let holdId: string;
  const stored = async () =>
    (
      await w.t.dataSource.query(
        `SELECT b.status, array_agg(s.released_at) AS released FROM bookings b JOIN booking_seats s ON s.booking_id = b.id WHERE b.id = $1 GROUP BY b.id`,
        [holdId],
      )
    )[0] as { status: string; released: (Date | null)[] };

  beforeEach(async () => {
    w = await createBookingWorld({ now: '2026-03-10T12:00:00Z' });
    holdId = (await w.hold(w.attendees[0], seats('A1', 'A2')).expect(201)).body.id;
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-EXP-01: the seat is held until 12:04:59 and free from 12:05:00', async () => {
    const bob = w.attendees[1];
    w.t.clock.set('2026-03-10T12:04:59.999Z');
    expect(statusOf(await w.seatMap(bob), 'A1')).toBe('held');
    expect((await w.hold(bob, seats('A1')).expect(409)).body.error.reason).toBe('SEAT_UNAVAILABLE');

    w.t.clock.set('2026-03-10T12:05:00.000Z');
    expect(statusOf(await w.seatMap(bob), 'A1')).toBe('available');
    expect((await w.seatMap(w.attendees[0])).myHold).toBeNull();
    await w.hold(bob, seats('A1', 'A2')).expect(201);
    expect(await stored()).toEqual({ status: 'expired', released: [new Date('2026-03-10T12:05:00Z'), new Date('2026-03-10T12:05:00Z')] });
  });

  it('T-EXP-02: the expiry job does nothing at 12:04:59 and releases the hold at 12:05:00', async () => {
    const job = w.t.app.get(HoldExpiryService);
    w.t.clock.set('2026-03-10T12:04:59Z');
    expect(await job.releaseExpired()).toEqual([]);
    expect(await stored()).toEqual({ status: 'held', released: [null, null] });

    w.t.clock.set('2026-03-10T12:05:00Z');
    expect(await job.releaseExpired()).toEqual([w.event.id]);
    expect(await stored()).toEqual({ status: 'expired', released: [new Date('2026-03-10T12:05:00Z'), new Date('2026-03-10T12:05:00Z')] });

    w.t.clock.set('2026-03-10T12:30:00Z');
    expect(await job.releaseExpired()).toEqual([]);
    expect((await stored()).released[0]).toEqual(new Date('2026-03-10T12:05:00Z'));
  });

  it('T-EXP-03: the owner cannot confirm an expired hold', async () => {
    const owner = w.attendees[0];
    w.t.clock.set('2026-03-10T12:05:00Z');
    const late = await w.api().post(`/api/holds/${holdId}/confirm`).set(bearer(owner.token)).expect(409);
    expect(late.body.error.reason).toBe('HOLD_EXPIRED');

    await w.t.app.get(HoldExpiryService).releaseExpired();
    const afterJob = await w.api().post(`/api/holds/${holdId}/confirm`).set(bearer(owner.token)).expect(409);
    expect(afterJob.body.error.reason).toBe('HOLD_EXPIRED');
    const history = await w.api().get('/api/bookings').set(bearer(owner.token)).expect(200);
    expect(history.body[0]).toMatchObject({ id: holdId, status: 'expired' });
  });
});
