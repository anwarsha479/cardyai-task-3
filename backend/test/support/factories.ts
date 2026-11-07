import { hash } from 'bcryptjs';
import { DataSource } from 'typeorm';
import { Role } from '../../src/auth/enums/role.enum';
import { SeatRef } from '../../src/bookings/utils/booking-rules.util';
import { parseSeatLabel } from '../../src/database/seeds/seed';
import { Event } from '../../src/events/entities/event.entity';
import { User } from '../../src/users/entities/user.entity';

export const TEST_PASSWORD = 'correct-horse-battery';
export const DEFAULT_EVENT_START = '2026-04-10T19:00:00.000Z';

let sequence = 0;
let passwordHash: string | undefined;

export async function createUser(dataSource: DataSource, options: { role?: Role; name?: string } = {}): Promise<User> {
  sequence += 1;
  const role = options.role ?? Role.Attendee;
  passwordHash ??= await hash(TEST_PASSWORD, 4);
  const repo = dataSource.getRepository(User);
  return repo.save(repo.create({ role, name: options.name ?? `${role} ${sequence}`, email: `${role}${sequence}@example.test`, passwordHash }));
}

export async function createEvent(
  dataSource: DataSource,
  organizer: User,
  options: { name?: string; startsAt?: string; seatRows?: number; seatsPerRow?: number } = {},
): Promise<Event> {
  sequence += 1;
  return dataSource.getRepository(Event).save({
    name: options.name ?? `Event ${sequence}`,
    description: null,
    venue: 'Main Hall',
    startsAt: new Date(options.startsAt ?? DEFAULT_EVENT_START),
    seatRows: options.seatRows ?? 10,
    seatsPerRow: options.seatsPerRow ?? 12,
    createdById: organizer.id,
  });
}

/** `seats('A1', 'B2')` → `[{ row: 1, number: 1 }, { row: 2, number: 2 }]` */
export function seats(...labels: string[]): SeatRef[] {
  return labels.map(parseSeatLabel);
}

/** Removes stored settings so the defaults apply again. */
export async function resetSettings(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM settings');
}

export async function setSetting(dataSource: DataSource, key: string, value: number): Promise<void> {
  await dataSource.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}
