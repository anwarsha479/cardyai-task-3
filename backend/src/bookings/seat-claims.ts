import { EntityManager } from 'typeorm';
import { SeatRef } from './utils/booking-rules.util';

/**
 * SQL condition for a claim that currently occupies its seat: not released, and either booked or
 * held with time left. `$now` must be bound by the caller.
 */
const OCCUPYING = `s.released_at IS NULL AND (b.status = 'confirmed' OR (b.status = 'held' AND b.hold_expires_at > $now))`;

export interface OccupiedSeat extends SeatRef {
  bookingId: string;
  attendeeId: string;
  status: 'held' | 'confirmed';
}

function bind(sql: string, now: Date, params: unknown[]): [string, unknown[]] {
  return [sql.replaceAll('$now', `$${params.length + 1}`), [...params, now]];
}

export async function occupiedSeats(manager: EntityManager, eventId: string, now: Date, only?: SeatRef[]): Promise<OccupiedSeat[]> {
  const params: unknown[] = [eventId];
  let filter = '';
  if (only) {
    params.push(only.map((s) => s.row), only.map((s) => s.number));
    filter = `AND (s.seat_row, s.seat_number) IN (SELECT * FROM unnest($2::smallint[], $3::smallint[]))`;
  }
  const [sql, values] = bind(
    `SELECT s.seat_row AS row, s.seat_number AS number, b.id AS "bookingId", b.attendee_id AS "attendeeId", b.status
       FROM booking_seats s JOIN bookings b ON b.id = s.booking_id
      WHERE s.event_id = $1 AND ${OCCUPYING} ${filter}
      ORDER BY s.seat_row, s.seat_number`,
    now,
    params,
  );
  return manager.query(sql, values);
}

export async function occupiedCounts(manager: EntityManager, now: Date): Promise<Map<string, { held: number; booked: number }>> {
  const [sql, values] = bind(
    `SELECT s.event_id AS "eventId",
            count(*) FILTER (WHERE b.status = 'held')::int AS held,
            count(*) FILTER (WHERE b.status = 'confirmed')::int AS booked
       FROM booking_seats s JOIN bookings b ON b.id = s.booking_id
      WHERE ${OCCUPYING}
      GROUP BY s.event_id`,
    now,
    [],
  );
  const rows: { eventId: string; held: number; booked: number }[] = await manager.query(sql, values);
  return new Map(rows.map((r) => [r.eventId, { held: r.held, booked: r.booked }]));
}

/**
 * Marks held bookings whose time is up as expired and releases their seats, recording the release at
 * the hold's own expiry time. Rows are locked in id order so concurrent callers cannot deadlock.
 * Returns the ids of the events that changed.
 */
export async function releaseExpiredHolds(manager: EntityManager, now: Date, eventId?: string): Promise<string[]> {
  const params: unknown[] = [now];
  if (eventId) params.push(eventId);
  const expired: { id: string; event_id: string }[] = await manager.query(
    `SELECT id, event_id FROM bookings
      WHERE status = 'held' AND hold_expires_at <= $1 ${eventId ? 'AND event_id = $2' : ''}
      ORDER BY id FOR UPDATE`,
    params,
  );
  if (expired.length === 0) return [];
  const ids = expired.map((b) => b.id);
  await manager.query(`UPDATE bookings SET status = 'expired', updated_at = $2 WHERE id = ANY($1::uuid[])`, [ids, now]);
  await manager.query(
    `UPDATE booking_seats s SET released_at = b.hold_expires_at
       FROM bookings b
      WHERE s.booking_id = b.id AND b.id = ANY($1::uuid[]) AND s.released_at IS NULL`,
    [ids],
  );
  return [...new Set(expired.map((b) => b.event_id))];
}

export async function releaseClaims(manager: EntityManager, bookingId: string, now: Date): Promise<void> {
  await manager.query(`UPDATE booking_seats SET released_at = $2 WHERE booking_id = $1 AND released_at IS NULL`, [bookingId, now]);
}
