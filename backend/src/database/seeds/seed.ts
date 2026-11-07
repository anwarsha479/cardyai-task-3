import { randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Role } from '../../auth/enums/role.enum';
import { BookingSeat } from '../../bookings/entities/booking-seat.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { BookingStatus } from '../../bookings/enums/booking-status.enum';
import { checkSeatSelection, holdExpiresAt, SeatRef, seatLabel } from '../../bookings/utils/booking-rules.util';
import { Clock } from '../../common/clock/clock';
import { Event } from '../../events/entities/event.entity';
import { defaultLimits } from '../../settings/settings.constants';
import { Setting } from '../../settings/entities/setting.entity';
import { User } from '../../users/entities/user.entity';
import { EventKey, EXPECTED_COUNTS, SEED_ATTENDEES, SEED_BOOKINGS, SEED_EVENT_START_HOUR, SEED_EVENTS, SEED_ORGANIZER } from './seed-data';

export const SEED_ENTITIES = [User, Setting, Event, Booking, BookingSeat];

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

export interface SeedOptions {
  clock: Clock;
  password: string;
}

function fail(item: string, rule: string): never {
  throw new Error(`Seed data invalid — ${item}: ${rule}`);
}

export function parseSeatLabel(label: string): SeatRef {
  const match = /^([A-Z])(\d+)$/.exec(label);
  if (!match) fail(label, 'not a seat label');
  return { row: match[1].charCodeAt(0) - 64, number: Number(match[2]) };
}

/**
 * Builds the demo dataset, checks every booking with the API's own seat rules, then writes it in one
 * transaction (where the seat index checks it again). Running it a second time does nothing.
 */
export async function runSeed(dataSource: DataSource, options: SeedOptions): Promise<{ created: boolean }> {
  const alreadySeeded = await dataSource.getRepository(User).existsBy({ email: SEED_ORGANIZER.email });
  if (alreadySeeded) return { created: false };

  const now = options.clock.now();
  const limits = defaultLimits();
  const passwordHash = await hash(options.password, 10);

  const organizer = { id: randomUUID(), ...SEED_ORGANIZER, role: Role.Organizer, passwordHash };
  const attendees = SEED_ATTENDEES.map((a) => ({ id: randomUUID(), ...a, role: Role.Attendee, passwordHash }));

  const events = Object.fromEntries(
    (Object.keys(SEED_EVENTS) as EventKey[]).map((key) => {
      const { startsInDays, ...rest } = SEED_EVENTS[key];
      // Evening start in the time zone of the machine running the seed.
      const startsAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + startsInDays, SEED_EVENT_START_HOUR);
      return [key, { id: randomUUID(), ...rest, startsAt, createdById: organizer.id }];
    }),
  ) as Record<EventKey, Event>;

  const active = new Set<string>();
  const bookings: Partial<Booking>[] = [];
  const claims: Partial<BookingSeat>[] = [];
  SEED_BOOKINGS.forEach((planned, i) => {
    const item = `booking ${i + 1}`;
    const event = events[planned.event];
    const attendee = attendees[planned.attendee - 1] ?? fail(item, 'unknown attendee');
    let seats: SeatRef[];
    try {
      seats = checkSeatSelection(planned.seats.map(parseSeatLabel), event, limits.maxSeatsPerBooking);
    } catch (error) {
      fail(item, error instanceof Error ? error.message : String(error));
    }
    const createdAt = new Date(now.getTime() - planned.daysAgo * DAY_MS);
    const cancelledAt = planned.status === 'cancelled' ? new Date(createdAt.getTime() + DAY_MS) : null;
    if (createdAt >= event.startsAt || (cancelledAt && cancelledAt > now)) fail(item, 'dates out of order');
    const id = randomUUID();
    bookings.push({
      id,
      eventId: event.id,
      attendeeId: attendee.id,
      status: planned.status === 'confirmed' ? BookingStatus.Confirmed : BookingStatus.Cancelled,
      holdExpiresAt: holdExpiresAt(createdAt, limits.holdDurationMinutes),
      confirmedAt: new Date(createdAt.getTime() + 2 * MINUTE_MS),
      cancelledAt,
      createdAt,
      updatedAt: cancelledAt ?? createdAt,
    });
    for (const seat of seats) {
      const key = `${event.id}:${seat.row}:${seat.number}`;
      if (!cancelledAt) {
        if (active.has(key)) fail(item, `seat ${seatLabel(seat.row, seat.number)} is already booked`);
        active.add(key);
      }
      claims.push({ bookingId: id, eventId: event.id, ...seat, releasedAt: cancelledAt });
    }
  });
  if (bookings.length !== EXPECTED_COUNTS.bookings) fail('bookings', `expected ${EXPECTED_COUNTS.bookings}`);

  await dataSource.transaction(async (manager) => {
    await manager.insert(User, [organizer, ...attendees]);
    await manager.insert(Event, Object.values(events));
    await manager.insert(Booking, bookings);
    await manager.insert(BookingSeat, claims);
  });
  return { created: true };
}
