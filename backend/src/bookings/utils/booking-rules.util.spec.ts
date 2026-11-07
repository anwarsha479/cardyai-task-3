import { AppError, RuleReason } from '../../common/exceptions/app-error';
import {
  assertEventOpen,
  checkSeatSelection,
  holdExpiresAt,
  isHoldExpired,
  seatLabel,
  seatsOutsideGrid,
} from './booking-rules.util';

const grid = { seatRows: 10, seatsPerRow: 12 };

function errorOf(fn: () => unknown): AppError {
  try {
    fn();
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error('Expected an AppError');
}

describe('booking rules', () => {
  it('T-UNIT-01: seat labels use a row letter and a seat number', () => {
    expect(seatLabel(1, 1)).toBe('A1');
    expect(seatLabel(10, 12)).toBe('J12');
    expect(seatLabel(26, 50)).toBe('Z50');
  });

  it('T-UNIT-02: a valid selection comes back in seat order', () => {
    const seats = checkSeatSelection(
      [
        { row: 2, number: 3 },
        { row: 1, number: 9 },
        { row: 2, number: 1 },
      ],
      grid,
      4,
    );
    expect(seats).toEqual([
      { row: 1, number: 9 },
      { row: 2, number: 1 },
      { row: 2, number: 3 },
    ]);
  });

  it('T-UNIT-03: empty, duplicate and off-grid selections are validation errors', () => {
    expect(errorOf(() => checkSeatSelection([], grid, 4)).code).toBe('VALIDATION_ERROR');
    const dup = errorOf(() => checkSeatSelection([{ row: 1, number: 1 }, { row: 1, number: 1 }], grid, 4));
    expect(dup.message).toContain('A1');
    const off = errorOf(() => checkSeatSelection([{ row: 11, number: 1 }, { row: 1, number: 13 }], grid, 4));
    expect(off.message).toContain('K1, A13');
  });

  it('T-UNIT-04: more seats than the maximum give SEAT_LIMIT_EXCEEDED', () => {
    const seats = [1, 2, 3].map((n) => ({ row: 1, number: n }));
    expect(checkSeatSelection(seats, grid, 3)).toHaveLength(3);
    const error = errorOf(() => checkSeatSelection(seats, grid, 2));
    expect(error.reason).toBe(RuleReason.SEAT_LIMIT_EXCEEDED);
    expect(error.details).toEqual({ max: 2, requested: 3 });
  });

  it('T-UNIT-05: a hold expires exactly at its expiry instant', () => {
    const now = new Date('2026-03-10T12:00:00Z');
    const expiresAt = holdExpiresAt(now, 5);
    expect(expiresAt.toISOString()).toBe('2026-03-10T12:05:00.000Z');
    expect(isHoldExpired(expiresAt, new Date('2026-03-10T12:04:59.999Z'))).toBe(false);
    expect(isHoldExpired(expiresAt, new Date('2026-03-10T12:05:00.000Z'))).toBe(true);
  });

  it('T-UNIT-06: an event is closed from its start time', () => {
    const startsAt = new Date('2026-03-10T19:00:00Z');
    expect(() => assertEventOpen(startsAt, new Date('2026-03-10T18:59:59Z'))).not.toThrow();
    expect(errorOf(() => assertEventOpen(startsAt, startsAt)).reason).toBe(RuleReason.EVENT_CLOSED);
  });

  it('T-UNIT-07: shrinking a grid reports the seats it would drop', () => {
    const claimed = [
      { row: 10, number: 1 },
      { row: 3, number: 12 },
      { row: 2, number: 2 },
    ];
    expect(seatsOutsideGrid(claimed, { seatRows: 9, seatsPerRow: 11 })).toEqual([
      { row: 10, number: 1 },
      { row: 3, number: 12 },
    ]);
  });
});
