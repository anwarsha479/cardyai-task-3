import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { BookingStatus } from '../enums/booking-status.enum';
import { BookingSeat } from './booking-seat.entity';

@Entity({ name: 'bookings' })
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'event_id' })
  event?: Event;

  @Column({ name: 'attendee_id', type: 'uuid' })
  attendeeId: string;

  @Column({ type: 'enum', enum: BookingStatus, enumName: 'booking_status' })
  status: BookingStatus;

  @Column({ name: 'hold_expires_at', type: 'timestamptz' })
  holdExpiresAt: Date;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @OneToMany(() => BookingSeat, (seat) => seat.booking)
  seats?: BookingSeat[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
