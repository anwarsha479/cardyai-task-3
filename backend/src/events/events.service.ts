import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { occupiedCounts, occupiedSeats, releaseExpiredHolds } from '../bookings/seat-claims';
import { assertEventOpen, seatLabel, seatsOutsideGrid } from '../bookings/utils/booking-rules.util';
import { Clock, CLOCK } from '../common/clock/clock';
import { AppError, RuleReason } from '../common/exceptions/app-error';
import { SeatUpdatesService } from '../seat-updates/seat-updates.service';
import { SettingsService } from '../settings/settings.service';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { EventViewDto, SeatDto, SeatMapDto } from './dto/event-view.dto';
import { Event } from './entities/event.entity';

function toView(event: Event, now: Date, occupied = { held: 0, booked: 0 }): EventViewDto {
  const capacity = event.seatRows * event.seatsPerRow;
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    venue: event.venue,
    startsAt: event.startsAt,
    seatRows: event.seatRows,
    seatsPerRow: event.seatsPerRow,
    isOpen: now.getTime() < event.startsAt.getTime(),
    seats: { capacity, available: capacity - occupied.held - occupied.booked, ...occupied },
  };
}

@Injectable()
export class EventsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: SettingsService,
    private readonly updates: SeatUpdatesService,
  ) {}

  async list(): Promise<EventViewDto[]> {
    const now = this.clock.now();
    const manager = this.dataSource.manager;
    const events = await manager.find(Event, { order: { startsAt: 'ASC' } });
    const upcoming = events.filter((e) => e.startsAt.getTime() > now.getTime());
    const past = events.filter((e) => e.startsAt.getTime() <= now.getTime()).reverse();
    const counts = await occupiedCounts(manager, now);
    return [...upcoming, ...past].map((e) => toView(e, now, counts.get(e.id)));
  }

  async get(id: string): Promise<EventViewDto> {
    const now = this.clock.now();
    const event = await this.find(this.dataSource.manager, id);
    const counts = await occupiedCounts(this.dataSource.manager, now);
    return toView(event, now, counts.get(id));
  }

  async create(user: AuthUser, dto: CreateEventDto): Promise<EventViewDto> {
    const now = this.clock.now();
    const startsAt = this.futureStart(dto.startsAt, now);
    const event = await this.dataSource.manager.save(Event, {
      name: dto.name,
      description: dto.description ?? null,
      venue: dto.venue,
      startsAt,
      seatRows: dto.seatRows,
      seatsPerRow: dto.seatsPerRow,
      createdById: user.id,
    });
    return toView(event, now);
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventViewDto> {
    const now = this.clock.now();
    let gridChanged = false;
    const saved = await this.dataSource.transaction(async (manager) => {
      // FOR UPDATE waits for in-flight holds (they take FOR SHARE) and blocks new ones until the grid is saved.
      const event = await this.find(manager, id, true);
      assertEventOpen(event.startsAt, now);
      if (dto.startsAt !== undefined) event.startsAt = this.futureStart(dto.startsAt, now);
      const grid = { seatRows: dto.seatRows ?? event.seatRows, seatsPerRow: dto.seatsPerRow ?? event.seatsPerRow };
      gridChanged = grid.seatRows !== event.seatRows || grid.seatsPerRow !== event.seatsPerRow;
      if (gridChanged) {
        await releaseExpiredHolds(manager, now, id);
        const dropped = seatsOutsideGrid(await occupiedSeats(manager, id, now), grid);
        if (dropped.length > 0) {
          const labels = dropped.map((s) => seatLabel(s.row, s.number));
          throw AppError.rule(RuleReason.SEATS_IN_USE, `These seats are held or booked: ${labels.join(', ')}`, { seats: labels });
        }
      }
      Object.assign(event, {
        name: dto.name ?? event.name,
        description: dto.description !== undefined ? dto.description : event.description,
        venue: dto.venue ?? event.venue,
        ...grid,
      });
      return manager.save(Event, event);
    });
    if (gridChanged) this.updates.publish(id);
    const counts = await occupiedCounts(this.dataSource.manager, now);
    return toView(saved, now, counts.get(id));
  }

  async seatMap(user: AuthUser, id: string): Promise<SeatMapDto> {
    const now = this.clock.now();
    const manager = this.dataSource.manager;
    const event = await this.find(manager, id);
    const [occupied, limits] = await Promise.all([occupiedSeats(manager, id, now), this.settings.getLimits()]);
    const byLabel = new Map(occupied.map((o) => [seatLabel(o.row, o.number), o]));

    const seats: SeatDto[] = [];
    for (let row = 1; row <= event.seatRows; row++) {
      for (let number = 1; number <= event.seatsPerRow; number++) {
        const label = seatLabel(row, number);
        const claim = byLabel.get(label);
        seats.push({
          row,
          number,
          label,
          status: !claim ? 'available' : claim.status === 'confirmed' ? 'booked' : 'held',
          mine: claim?.attendeeId === user.id,
        });
      }
    }

    const mine = occupied.filter((o) => o.attendeeId === user.id && o.status === 'held');
    let myHold: SeatMapDto['myHold'] = null;
    if (mine.length > 0) {
      const booking = await manager.query(`SELECT hold_expires_at FROM bookings WHERE id = $1`, [mine[0].bookingId]);
      myHold = {
        id: mine[0].bookingId,
        expiresAt: booking[0].hold_expires_at,
        seats: mine.map((s) => ({ row: s.row, number: s.number, label: seatLabel(s.row, s.number) })),
      };
    }
    const held = occupied.filter((o) => o.status === 'held').length;
    return {
      event: toView(event, now, { held, booked: occupied.length - held }),
      serverTime: now,
      maxSeatsPerBooking: limits.maxSeatsPerBooking,
      holdDurationMinutes: limits.holdDurationMinutes,
      seats,
      myHold,
    };
  }

  private async find(manager: EntityManager, id: string, forUpdate = false): Promise<Event> {
    const event = await manager.findOne(Event, { where: { id }, lock: forUpdate ? { mode: 'pessimistic_write' } : undefined });
    if (!event) throw AppError.notFound('Event');
    return event;
  }

  private futureStart(value: string, now: Date): Date {
    const startsAt = new Date(value);
    if (startsAt.getTime() <= now.getTime()) {
      throw AppError.validation({ startsAt: ['The event must start in the future'] });
    }
    return startsAt;
  }
}
