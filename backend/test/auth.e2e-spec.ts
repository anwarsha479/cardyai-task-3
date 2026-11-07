import { bearer } from './support/auth-helpers';
import { BookingWorld, createBookingWorld } from './support/booking-world';
import { seats, TEST_PASSWORD } from './support/factories';

describe('Roles are enforced on the server', () => {
  let w: BookingWorld;

  beforeEach(async () => {
    w = await createBookingWorld();
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-AUTH-01: sign in returns a token and role; wrong password and unknown email get the same 401', async () => {
    const ok = await w.api().post('/api/auth/login').send({ email: w.organizer.user.email, password: TEST_PASSWORD }).expect(200);
    expect(ok.body.accessToken).toEqual(expect.any(String));
    expect(ok.body.user).toMatchObject({ id: w.organizer.user.id, role: 'organizer' });

    const wrong = await w.api().post('/api/auth/login').send({ email: w.organizer.user.email, password: 'nope' }).expect(401);
    const unknown = await w.api().post('/api/auth/login').send({ email: 'ghost@example.test', password: TEST_PASSWORD }).expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);

    const me = await w.api().get('/api/auth/me').set(bearer(ok.body.accessToken)).expect(200);
    expect(me.body.email).toBe(w.organizer.user.email);
  });

  it('T-AUTH-02: no token or a bad token gets 401 everywhere, including the seat stream', async () => {
    const paths = ['/api/auth/me', '/api/events', `/api/events/${w.event.id}/seats`, `/api/events/${w.event.id}/seats/stream`, '/api/bookings', '/api/settings'];
    for (const path of paths) {
      const none = await w.api().get(path).expect(401);
      expect(none.body.error.code).toBe('UNAUTHENTICATED');
      await w.api().get(path).set(bearer('not-a-token')).expect(401);
    }
    await w.api().post(`/api/events/${w.event.id}/holds`).send({ seats: seats('A1') }).expect(401);
  });

  it('T-AUTH-03: an attendee cannot create or edit events or change settings', async () => {
    const attendee = w.attendees[0];
    const body = { name: 'Mine', venue: 'Here', startsAt: '2026-05-01T19:00:00Z', seatRows: 2, seatsPerRow: 2 };
    const created = await w.api().post('/api/events').set(bearer(attendee.token)).send(body).expect(403);
    expect(created.body.error).toMatchObject({ code: 'FORBIDDEN', message: 'Organizer role required' });
    await w.api().patch(`/api/events/${w.event.id}`).set(bearer(attendee.token)).send({ seatRows: 1 }).expect(403);
    await w.api().patch('/api/settings').set(bearer(attendee.token)).send({ maxSeatsPerBooking: 10 }).expect(403);
  });

  it('T-AUTH-04: an organizer cannot hold, confirm, release or cancel', async () => {
    const hold = await w.hold(w.attendees[0], seats('A1')).expect(201);
    const org = bearer(w.organizer.token);
    await w.hold(w.organizer, seats('A2')).expect(403);
    await w.api().post(`/api/holds/${hold.body.id}/confirm`).set(org).expect(403);
    await w.api().delete(`/api/holds/${hold.body.id}`).set(org).expect(403);
    await w.api().post(`/api/bookings/${hold.body.id}/cancel`).set(org).expect(403);
    await w.api().get('/api/bookings').set(org).expect(403);
  });

  it("T-AUTH-05: an attendee cannot confirm, release or cancel someone else's booking", async () => {
    const [owner, other] = w.attendees;
    const hold = await w.hold(owner, seats('A1')).expect(201);
    await w.api().post(`/api/holds/${hold.body.id}/confirm`).set(bearer(other.token)).expect(403);
    await w.api().delete(`/api/holds/${hold.body.id}`).set(bearer(other.token)).expect(403);

    await w.api().post(`/api/holds/${hold.body.id}/confirm`).set(bearer(owner.token)).expect(200);
    const cancel = await w.api().post(`/api/bookings/${hold.body.id}/cancel`).set(bearer(other.token)).expect(403);
    expect(cancel.body.error.code).toBe('FORBIDDEN');
    expect((await w.seatMap(owner)).seats.find((s) => s.label === 'A1')).toMatchObject({ status: 'booked', mine: true });
  });
});
