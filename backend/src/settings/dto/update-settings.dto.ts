import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { SETTING_DEFINITIONS as D } from '../settings.constants';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ minimum: D.holdDurationMinutes.min, maximum: D.holdDurationMinutes.max })
  @IsOptional()
  @IsInt()
  @Min(D.holdDurationMinutes.min)
  @Max(D.holdDurationMinutes.max)
  holdDurationMinutes?: number;

  @ApiPropertyOptional({ minimum: D.maxSeatsPerBooking.min, maximum: D.maxSeatsPerBooking.max })
  @IsOptional()
  @IsInt()
  @Min(D.maxSeatsPerBooking.min)
  @Max(D.maxSeatsPerBooking.max)
  maxSeatsPerBooking?: number;
}
