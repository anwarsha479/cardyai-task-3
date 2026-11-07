import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Max, Min, ValidateNested } from 'class-validator';
import { SeatRefViewDto } from '../../events/dto/event-view.dto';
import { BookingStatus } from '../enums/booking-status.enum';
import { MAX_SEAT_ROWS, MAX_SEATS_PER_ROW } from '../utils/booking-rules.util';

export class SeatRefDto {
  @ApiProperty({ minimum: 1, maximum: MAX_SEAT_ROWS, description: 'Row 1 is A' })
  @IsInt()
  @Min(1)
  @Max(MAX_SEAT_ROWS)
  row: number;

  @ApiProperty({ minimum: 1, maximum: MAX_SEATS_PER_ROW })
  @IsInt()
  @Min(1)
  @Max(MAX_SEATS_PER_ROW)
  number: number;
}

export class CreateHoldDto {
  @ApiProperty({ type: SeatRefDto, isArray: true, example: [{ row: 3, number: 7 }] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one seat' })
  @ArrayMaxSize(MAX_SEAT_ROWS * MAX_SEATS_PER_ROW)
  @ValidateNested({ each: true })
  @Type(() => SeatRefDto)
  seats: SeatRefDto[];
}

export class BookingEventDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() venue: string;
  @ApiProperty({ format: 'date-time' }) startsAt: Date;
}

export class BookingViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: BookingStatus, description: 'A hold whose time is up reads as expired' }) status: BookingStatus;
  @ApiProperty({ type: BookingEventDto }) event: BookingEventDto;
  @ApiProperty({ type: SeatRefViewDto, isArray: true }) seats: SeatRefViewDto[];
  @ApiProperty({ format: 'date-time' }) holdExpiresAt: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) confirmedAt: Date | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) cancelledAt: Date | null;
  @ApiProperty({ format: 'date-time' }) createdAt: Date;
}
