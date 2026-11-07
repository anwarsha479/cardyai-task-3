import { AppError, RuleReason } from '../../common/exceptions/app-error';

export const MAX_SEAT_ROWS = 26;
export const MAX_SEATS_PER_ROW = 50;

export interface SeatRef {
  row: number;
  number: number;
}

export interface Grid {
  seatRows: number;
  seatsPerRow: number;
}

/** Row 1 is "A": (3, 7) → "C7". */
export function seatLabel(row: number, number: number): string {
  return `${String.fromCharCode(64 + row)}${number}`;
}

export function compareSeats(a: SeatRef, b: SeatRef): number {
  return a.row - b.row || a.number - b.number;
}

export function seatsOutsideGrid(seats: SeatRef[], grid: Grid): SeatRef[] {
  return seats.filter((s) => s.row > grid.seatRows || s.number > grid.seatsPerRow);
}

/** Validates a hold request and returns the seats in seat order (the order claims are written in). */
export function checkSeatSelection(seats: SeatRef[], grid: Grid, maxSeats: number): SeatRef[] {
  if (seats.length === 0) {
    throw AppError.validation({ seats: ['Select at least one seat'] });
  }
  const seen = new Set<string>();
  for (const seat of seats) {
    const label = seatLabel(seat.row, seat.number);
    if (seen.has(label)) throw AppError.validation({ seats: [`Seat ${label} is selected more than once`] });
    seen.add(label);
  }
  const outside = seatsOutsideGrid(seats, grid);
  if (outside.length > 0) {
    const labels = outside.map((s) => seatLabel(s.row, s.number));
    throw AppError.validation({ seats: [`Not on this event's seating plan: ${labels.join(', ')}`] });
  }
  if (seats.length > maxSeats) {
    throw AppError.rule(RuleReason.SEAT_LIMIT_EXCEEDED, `You can hold at most ${maxSeats} seats at a time`, {
      max: maxSeats,
      requested: seats.length,
    });
  }
  return [...seats].sort(compareSeats);
}

export function holdExpiresAt(now: Date, holdDurationMinutes: number): Date {
  return new Date(now.getTime() + holdDurationMinutes * 60_000);
}

/** A hold is expired from the exact instant it expires. */
export function isHoldExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export function assertEventOpen(startsAt: Date, now: Date): void {
  if (now.getTime() >= startsAt.getTime()) {
    throw AppError.rule(RuleReason.EVENT_CLOSED, 'This event has already started');
  }
}
