import request from 'supertest';
import { Role } from '../../src/auth/enums/role.enum';
import { SeatRef } from '../../src/bookings/utils/booking-rules.util';
import { Event } from '../../src/events/entities/event.entity';
import { User } from '../../src/users/entities/user.entity';
import { bearer, loginAs } from './auth-helpers';
import { createEvent, createUser } from './factories';
import { createTestApp, TestApp } from './test-app';

export interface Person {
  user: User;
  token: string;
}

/** A test app with one organizer, `attendees` signed-in attendees and one 10 × 12 event. */
export interface BookingWorld {
  t: TestApp;
  organizer: Person;
  attendees: Person[];
  event: Event;
  api(): ReturnType<typeof request>;
  hold(who: Person, seatList: SeatRef[], eventId?: string): request.Test;
  seatMap(who: Person, eventId?: string): Promise<{ seats: { label: string; status: string; mine: boolean }[]; myHold: unknown }>;
}

export async function createBookingWorld(options: { attendees?: number; now?: string } = {}): Promise<BookingWorld> {
  const t = await createTestApp({ now: options.now });
  const person = async (role: Role): Promise<Person> => {
    const user = await createUser(t.dataSource, { role });
    return { user, token: await loginAs(t.app, user) };
  };
  const organizer = await person(Role.Organizer);
  const attendees: Person[] = [];
  for (let i = 0; i < (options.attendees ?? 2); i++) attendees.push(await person(Role.Attendee));
  const event = await createEvent(t.dataSource, organizer.user);
  const api = () => request(t.app.getHttpServer());
  return {
    t,
    organizer,
    attendees,
    event,
    api,
    hold: (who, seatList, eventId = event.id) =>
      api().post(`/api/events/${eventId}/holds`).set(bearer(who.token)).send({ seats: seatList }),
    seatMap: async (who, eventId = event.id) =>
      (await api().get(`/api/events/${eventId}/seats`).set(bearer(who.token)).expect(200)).body,
  };
}

export function statusOf(map: { seats: { label: string; status: string }[] }, label: string): string | undefined {
  return map.seats.find((s) => s.label === label)?.status;
}
