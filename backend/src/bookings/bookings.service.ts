import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { Clock, CLOCK } from '../common/clock/clock';
import { AppError, RuleReason } from '../common/exceptions/app-error';
import { Event } from '../events/entities/event.entity';
import { SeatUpdatesService } from '../seat-updates/seat-updates.service';
import { SettingsService } from '../settings/settings.service';
import { BookingViewDto, CreateHoldDto } from './dto/booking.dto';
import { Booking } from './entities/booking.entity';
import { BookingStatus } from './enums/booking-status.enum';
import { occupiedSeats, releaseClaims, releaseExpiredHolds } from './seat-claims';
import {
  assertEventOpen,
  checkSeatSelection,
  compareSeats,
  holdExpiresAt,
  isHoldExpired,
  seatLabel,
  SeatRef,
} from './utils/booking-rules.util';

const ACTIVE_SEAT_INDEX = 'ux_booking_seats_active_seat';
const ONE_HOLD_INDEX = 'ux_bookings_one_active_hold';

function uniqueViolation(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) return null;
  const driver = error.driverError as { code?: string; constraint?: string };
  return driver.code === '23505' ? (driver.constraint ?? '') : null;
}

function seatUnavailable(seats: SeatRef[]): AppError {
  const labels = seats.map((s) => seatLabel(s.row, s.number));
  return AppError.rule(
    RuleReason.SEAT_UNAVAILABLE,
    labels.length > 0 ? `Already taken: ${labels.join(', ')}` : 'Some of these seats were just taken',
    { seats: labels },
  );
}

function holdExists(): AppError {
  return AppError.rule(RuleReason.HOLD_EXISTS, 'You already have seats on hold for this event. Confirm or release them first.');
}

export function toBookingView(booking: Booking, now: Date): BookingViewDto {
  const event = booking.event!;
  const expired = booking.status === BookingStatus.Held && isHoldExpired(booking.holdExpiresAt, now);
  return {
    id: booking.id,
    status: expired ? BookingStatus.Expired : booking.status,
    event: { id: event.id, name: event.name, venue: event.venue, startsAt: event.startsAt },
    seats: [...(booking.seats ?? [])]
      .sort(compareSeats)
      .map((s) => ({ row: s.row, number: s.number, label: seatLabel(s.row, s.number) })),
    holdExpiresAt: booking.holdExpiresAt,
    confirmedAt: booking.confirmedAt,
    cancelledAt: booking.cancelledAt,
    createdAt: booking.createdAt,
  };
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly updates: SeatUpdatesService,
  ) {}

  /**
   * Holds seats all-or-nothing. The service checks give friendly errors; the guarantee is the partial
   * unique index on booking_seats, which refuses a second active claim on a seat from any transaction.
   */
  async hold(user: AuthUser, eventId: string, dto: CreateHoldDto): Promise<BookingViewDto> {
    const now = this.clock.now();
    let seats: SeatRef[] = dto.seats;
    let bookingId: string;
    try {
      bookingId = await this.dataSource.transaction(async (manager) => {
        // FOR SHARE: holds run side by side, but the grid cannot change until this commits.
        const event = await manager.findOne(Event, { where: { id: eventId }, lock: { mode: 'pessimistic_read' } });
        if (!event) throw AppError.notFound('Event');
        assertEventOpen(event.startsAt, now);
        const limits = await this.settings.getLimits(manager);
        seats = checkSeatSelection(dto.seats, event, limits.maxSeatsPerBooking);

        await releaseExpiredHolds(manager, now, eventId);
        const [existing] = await manager.query(
          `SELECT 1 FROM bookings WHERE event_id = $1 AND attendee_id = $2 AND status = 'held'`,
          [eventId, user.id],
        );
        if (existing) throw holdExists();
        const taken = await occupiedSeats(manager, eventId, now, seats);
        if (taken.length > 0) throw seatUnavailable(taken);

        const [{ id }] = await manager.query(
          `INSERT INTO bookings (event_id, attendee_id, status, hold_expires_at, created_at, updated_at)
           VALUES ($1, $2, 'held', $3, $4, $4) RETURNING id`,
          [eventId, user.id, holdExpiresAt(now, limits.holdDurationMinutes), now],
        );
        // Claims go in seat order so two overlapping holds always contend on their first shared seat
        // and cannot deadlock.
        await manager.query(
          `INSERT INTO booking_seats (booking_id, event_id, seat_row, seat_number)
           SELECT $1, $2, r, n FROM unnest($3::smallint[], $4::smallint[]) WITH ORDINALITY AS t(r, n, i) ORDER BY i`,
          [id, eventId, seats.map((s) => s.row), seats.map((s) => s.number)],
        );
        return id as string;
      });
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (constraint === ACTIVE_SEAT_INDEX) {
        throw seatUnavailable(await occupiedSeats(this.dataSource.manager, eventId, this.clock.now(), seats));
      }
      if (constraint === ONE_HOLD_INDEX) throw holdExists();
      throw error;
    }
    this.updates.publish(eventId);
    return this.view(bookingId, now);
  }

  async confirm(user: AuthUser, holdId: string): Promise<BookingViewDto> {
    const now = this.clock.now();
    const booking = await this.dataSource.transaction(async (manager) => {
      const hold = await this.lockOwn(manager, user, holdId);
      if (hold.status === BookingStatus.Expired || (hold.status === BookingStatus.Held && isHoldExpired(hold.holdExpiresAt, now))) {
        throw AppError.rule(RuleReason.HOLD_EXPIRED, 'This hold has expired. Select your seats again.');
      }
      if (hold.status !== BookingStatus.Held) throw this.invalidState(hold.status);
      const event = await manager.findOneByOrFail(Event, { id: hold.eventId });
      assertEventOpen(event.startsAt, now);
      await manager.update(Booking, { id: hold.id }, { status: BookingStatus.Confirmed, confirmedAt: now, updatedAt: now });
      return hold;
    });
    this.updates.publish(booking.eventId);
    return this.view(booking.id, now);
  }

  async release(user: AuthUser, holdId: string): Promise<void> {
    const now = this.clock.now();
    const booking = await this.dataSource.transaction(async (manager) => {
      const hold = await this.lockOwn(manager, user, holdId);
      if (hold.status !== BookingStatus.Held || isHoldExpired(hold.holdExpiresAt, now)) {
        throw AppError.rule(RuleReason.INVALID_STATE, 'This hold is no longer active');
      }
      await this.cancelWithin(manager, hold.id, now);
      return hold;
    });
    this.updates.publish(booking.eventId);
  }

  async cancel(user: AuthUser, bookingId: string): Promise<BookingViewDto> {
    const now = this.clock.now();
    const booking = await this.dataSource.transaction(async (manager) => {
      const confirmed = await this.lockOwn(manager, user, bookingId);
      if (confirmed.status !== BookingStatus.Confirmed) throw this.invalidState(confirmed.status);
      const event = await manager.findOneByOrFail(Event, { id: confirmed.eventId });
      assertEventOpen(event.startsAt, now);
      await this.cancelWithin(manager, confirmed.id, now);
      return confirmed;
    });
    this.updates.publish(booking.eventId);
    return this.view(booking.id, now);
  }

  async history(user: AuthUser): Promise<BookingViewDto[]> {
    const now = this.clock.now();
    const bookings = await this.dataSource.manager.find(Booking, {
      where: { attendeeId: user.id },
      relations: { event: true, seats: true },
      order: { createdAt: 'DESC' },
    });
    return bookings.map((b) => toBookingView(b, now));
  }

  private async lockOwn(manager: EntityManager, user: AuthUser, id: string): Promise<Booking> {
    const booking = await manager.findOne(Booking, { where: { id }, lock: { mode: 'pessimistic_write' } });
    if (!booking) throw AppError.notFound('Booking');
    if (booking.attendeeId !== user.id) throw AppError.forbidden('This booking belongs to someone else');
    return booking;
  }

  private async cancelWithin(manager: EntityManager, bookingId: string, now: Date): Promise<void> {
    await manager.update(Booking, { id: bookingId }, { status: BookingStatus.Cancelled, cancelledAt: now, updatedAt: now });
    await releaseClaims(manager, bookingId, now);
  }

  private invalidState(status: BookingStatus): AppError {
    return AppError.rule(RuleReason.INVALID_STATE, `This booking is ${status}`, { status });
  }

  private async view(id: string, now: Date): Promise<BookingViewDto> {
    const booking = await this.dataSource.manager.findOneOrFail(Booking, {
      where: { id },
      relations: { event: true, seats: true },
    });
    return toBookingView(booking, now);
  }
}
