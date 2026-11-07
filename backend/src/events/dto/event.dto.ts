import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsInt, IsISO8601, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_SEAT_ROWS, MAX_SEATS_PER_ROW } from '../../bookings/utils/booking-rules.util';
import { Trim, TrimToNull } from '../../common/decorators/trim.decorator';

export class CreateEventDto {
  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Riverside Jazz Night' })
  @Trim()
  @IsString()
  @Length(1, 120)
  name: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @TrimToNull()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Harbour Hall' })
  @Trim()
  @IsString()
  @Length(1, 120)
  venue: string;

  @ApiProperty({ format: 'date-time', example: '2026-12-01T19:00:00Z', description: 'Must be in the future' })
  @IsISO8601({ strict: true, strictSeparator: true }, { message: 'startsAt must be a date and time' })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, { message: 'startsAt must include a time zone, e.g. Z or +01:00' })
  startsAt: string;

  @ApiProperty({ minimum: 1, maximum: MAX_SEAT_ROWS, example: 10 })
  @IsInt()
  @Min(1, { message: 'The grid needs at least one row' })
  @Max(MAX_SEAT_ROWS)
  seatRows: number;

  @ApiProperty({ minimum: 1, maximum: MAX_SEATS_PER_ROW, example: 12 })
  @IsInt()
  @Min(1, { message: 'The grid needs at least one seat per row' })
  @Max(MAX_SEATS_PER_ROW)
  seatsPerRow: number;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}
