import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsModule } from '../settings/settings.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingSeat } from './entities/booking-seat.entity';
import { Booking } from './entities/booking.entity';
import { HoldExpiryService } from './hold-expiry.service';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, BookingSeat]), SettingsModule],
  controllers: [BookingsController],
  providers: [BookingsService, HoldExpiryService],
})
export class BookingsModule {}
