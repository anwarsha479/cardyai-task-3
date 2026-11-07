import { SystemClock } from '../src/common/clock/clock';
import { EXPECTED_COUNTS } from '../src/database/seeds/seed-data';
import { runSeed } from '../src/database/seeds/seed';
import { createTestApp, TestApp } from './support/test-app';

describe('Demo seed', () => {
  let t: TestApp;
  const seed = () => runSeed(t.dataSource, { clock: new SystemClock(), password: 'seed-test-password' });
  const count = async (sql: string) => (await t.dataSource.query(sql))[0].n as number;

  beforeAll(async () => {
    t = await createTestApp();
    expect(await seed()).toEqual({ created: true });
  });

  afterAll(async () => {
    await t.close();
  });

  it('T-SEED-01: two events of 120 and 60 seats and 30 bookings', async () => {
    const events: { capacity: number; starts_at: Date }[] = await t.dataSource.query(
      `SELECT seat_rows * seats_per_row AS capacity, starts_at FROM events ORDER BY capacity DESC`,
    );
    expect(events.map((e) => e.capacity)).toEqual([120, 60]);
    expect(events.every((e) => e.starts_at.getTime() > Date.now())).toBe(true);
    expect(await count(`SELECT count(*)::int AS n FROM bookings`)).toBe(EXPECTED_COUNTS.bookings);
    expect(await count(`SELECT count(*)::int AS n FROM users WHERE role = 'attendee'`)).toBe(12);
    expect(await count(`SELECT count(*)::int AS n FROM users WHERE role = 'organizer'`)).toBe(1);
    expect(await count(`SELECT count(DISTINCT status)::int AS n FROM bookings`)).toBe(2);
  });

  it('T-SEED-02: no seat has two active claims and no booking is over the default maximum', async () => {
    expect(
      await count(`SELECT count(*)::int AS n FROM (
        SELECT 1 FROM booking_seats WHERE released_at IS NULL GROUP BY event_id, seat_row, seat_number HAVING count(*) > 1) d`),
    ).toBe(0);
    expect(await count(`SELECT max(c)::int AS n FROM (SELECT count(*) AS c FROM booking_seats GROUP BY booking_id) d`)).toBeLessThanOrEqual(4);
    expect(
      await count(`SELECT count(*)::int AS n FROM booking_seats s JOIN bookings b ON b.id = s.booking_id
        WHERE (b.status = 'cancelled') <> (s.released_at IS NOT NULL)`),
    ).toBe(0);
  });

  it('T-SEED-03: running the seed again adds nothing', async () => {
    expect(await seed()).toEqual({ created: false });
    expect(await count(`SELECT count(*)::int AS n FROM bookings`)).toBe(EXPECTED_COUNTS.bookings);
  });
});
