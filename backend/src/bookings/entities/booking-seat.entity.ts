import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Booking } from './booking.entity';

@Entity({ name: 'booking_seats' })
export class BookingSeat {
  @PrimaryColumn({ name: 'booking_id', type: 'uuid' })
  bookingId: string;

  @PrimaryColumn({ name: 'seat_row', type: 'smallint' })
  row: number;

  @PrimaryColumn({ name: 'seat_number', type: 'smallint' })
  number: number;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date | null;

  @ManyToOne(() => Booking, (booking) => booking.seats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking?: Booking;
}
