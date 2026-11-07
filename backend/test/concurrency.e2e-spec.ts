import { BookingWorld, createBookingWorld, statusOf } from './support/booking-world';
import { seats } from './support/factories';

const ROUNDS = 25;

describe('No seat can be held twice, even at the same moment', () => {
  let w: BookingWorld;

  beforeEach(async () => {
    w = await createBookingWorld({ attendees: 10 });
  });

  afterEach(async () => {
    await w.t.close();
  });

  it(`T-RACE-01: two attendees holding the same seat at once: exactly one wins, ${ROUNDS} times`, async () => {
    const [ann, bob] = w.attendees;
    for (let round = 0; round < ROUNDS; round++) {
      const seat = seats(`${String.fromCharCode(65 + (round % 10))}${Math.floor(round / 10) + 1}`);
      const results = await Promise.all([w.hold(ann, seat), w.hold(bob, seat)]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)!.body.error.reason).toBe('SEAT_UNAVAILABLE');

      // Release the winner's hold so both start the next round without a hold.
      const winner = results[0].status === 201 ? ann : bob;
      const id = results.find((r) => r.status === 201)!.body.id;
      await w.api().delete(`/api/holds/${id}`).set({ Authorization: `Bearer ${winner.token}` }).expect(204);
    }
    const active = await w.t.dataSource.query(`SELECT count(*)::int AS n FROM booking_seats WHERE released_at IS NULL`);
    expect(active[0].n).toBe(0);
  });

  it('T-RACE-02: ten attendees holding the same seat at once: exactly one wins', async () => {
    const results = await Promise.all(w.attendees.map((a) => w.hold(a, seats('E6'))));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    const claims = await w.t.dataSource.query(
      `SELECT count(*)::int AS n FROM booking_seats WHERE event_id = $1 AND seat_row = 5 AND seat_number = 6 AND released_at IS NULL`,
      [w.event.id],
    );
    expect(claims[0].n).toBe(1);
  });

  it('T-RACE-03: overlapping multi-seat holds at once: one gets all its seats, the other none', async () => {
    const [ann, bob] = w.attendees;
    for (let round = 0; round < 10; round++) {
      const row = String.fromCharCode(65 + round);
      const [a, b] = await Promise.all([w.hold(ann, seats(`${row}1`, `${row}2`)), w.hold(bob, seats(`${row}3`, `${row}2`))]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const map = await w.seatMap(w.attendees[2]);
      const held = [1, 2, 3].map((n) => statusOf(map, `${row}${n}`));
      expect(held).toEqual(a.status === 201 ? ['held', 'held', 'available'] : ['available', 'held', 'held']);
      const [winner, res] = a.status === 201 ? [ann, a] : [bob, b];
      await w.api().delete(`/api/holds/${res.body.id}`).set({ Authorization: `Bearer ${winner.token}` }).expect(204);
    }
  });

  it('T-RACE-04: the database itself refuses a second active claim, bypassing the API', async () => {
    const res = await w.hold(w.attendees[0], seats('G7')).expect(201);
    const [{ id: other }] = await w.t.dataSource.query(
      `INSERT INTO bookings (event_id, attendee_id, status, hold_expires_at, confirmed_at) VALUES ($1, $2, 'confirmed', now(), now()) RETURNING id`,
      [w.event.id, w.attendees[1].user.id],
    );
    await expect(
      w.t.dataSource.query(`INSERT INTO booking_seats (booking_id, event_id, seat_row, seat_number) VALUES ($1, $2, 7, 7)`, [other, w.event.id]),
    ).rejects.toMatchObject({ driverError: { code: '23505', constraint: 'ux_booking_seats_active_seat' } });

    await w.t.dataSource.query(`UPDATE booking_seats SET released_at = now() WHERE booking_id = $1`, [res.body.id]);
    await w.t.dataSource.query(`INSERT INTO booking_seats (booking_id, event_id, seat_row, seat_number) VALUES ($1, $2, 7, 7)`, [other, w.event.id]);
  });
});
