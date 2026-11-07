import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { SeatUpdatesController } from './seat-updates.controller';
import { SeatUpdatesService } from './seat-updates.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Event])],
  controllers: [SeatUpdatesController],
  providers: [SeatUpdatesService],
  exports: [SeatUpdatesService],
})
export class SeatUpdatesModule {}
