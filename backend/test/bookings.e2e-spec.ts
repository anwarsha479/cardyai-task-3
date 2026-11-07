import { bearer } from './support/auth-helpers';
import { BookingWorld, createBookingWorld, Person, statusOf } from './support/booking-world';
import { createEvent, seats } from './support/factories';

describe('Booking history and cancellation', () => {
  let w: BookingWorld;
  const book = async (who: Person, labels: string[], eventId?: string): Promise<string> => {
    const hold = await w.hold(who, seats(...labels), eventId).expect(201);
    await w.api().post(`/api/holds/${hold.body.id}/confirm`).set(bearer(who.token)).expect(200);
    return hold.body.id;
  };
  const cancel = (who: Person, id: string) => w.api().post(`/api/bookings/${id}/cancel`).set(bearer(who.token));
  const history = async (who: Person) => (await w.api().get('/api/bookings').set(bearer(who.token)).expect(200)).body;

  beforeEach(async () => {
    w = await createBookingWorld();
  });

  afterEach(async () => {
    await w.t.close();
  });

  it('T-BOOK-02: each attendee sees only their own bookings, newest first', async () => {
    const [ann, bob] = w.attendees;
    const other = await createEvent(w.t.dataSource, w.organizer.user, { name: 'Matinee' });
    const first = await book(ann, ['A2', 'A1']);
    w.t.clock.set('2026-03-10T12:10:00Z');
    const second = await book(ann, ['B1'], other.id);
    await book(bob, ['C1']);

    const list = await history(ann);
    expect(list.map((b: { id: string }) => b.id)).toEqual([second, first]);
    expect(list[1]).toMatchObject({
      status: 'confirmed',
      event: { id: w.event.id, name: w.event.name, venue: 'Main Hall', startsAt: '2026-04-10T19:00:00.000Z' },
      seats: [
        { row: 1, number: 1, label: 'A1' },
        { row: 1, number: 2, label: 'A2' },
      ],
    });
    expect(await history(bob)).toHaveLength(1);
  });

  it('T-BOOK-03: cancelling frees the seats for someone else straight away', async () => {
    const [ann, bob] = w.attendees;
    const id = await book(ann, ['D1', 'D2']);
    await w.hold(bob, seats('D1')).expect(409);

    w.t.clock.set('2026-03-11T09:00:00Z');
    const res = await cancel(ann, id).expect(200);
    expect(res.body).toMatchObject({ status: 'cancelled', cancelledAt: '2026-03-11T09:00:00.000Z' });
    expect(statusOf(await w.seatMap(bob), 'D1')).toBe('available');
    await w.hold(bob, seats('D1', 'D2')).expect(201);
    expect((await history(ann))[0].status).toBe('cancelled');
  });

  it('T-BOOK-04: a cancelled booking, a hold, or a started event cannot be cancelled', async () => {
    const [ann] = w.attendees;
    const id = await book(ann, ['E1']);
    await cancel(ann, id).expect(200);
    expect((await cancel(ann, id).expect(409)).body.error).toMatchObject({ reason: 'INVALID_STATE', details: { status: 'cancelled' } });

    const hold = await w.hold(ann, seats('E2')).expect(201);
    expect((await cancel(ann, hold.body.id).expect(409)).body.error.reason).toBe('INVALID_STATE');
    await w.api().delete(`/api/holds/${hold.body.id}`).set(bearer(ann.token)).expect(204);

    const booked = await book(ann, ['E3']);
    w.t.clock.set('2026-04-10T19:00:00Z');
    expect((await cancel(ann, booked).expect(409)).body.error.reason).toBe('EVENT_CLOSED');
    expect(statusOf(await w.seatMap(ann), 'E3')).toBe('booked');
  });
});
