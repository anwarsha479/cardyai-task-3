import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SeatCountsDto {
  @ApiProperty() capacity: number;
  @ApiProperty() available: number;
  @ApiProperty() held: number;
  @ApiProperty() booked: number;
}

export class EventViewDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty() venue: string;
  @ApiProperty({ format: 'date-time' }) startsAt: Date;
  @ApiProperty() seatRows: number;
  @ApiProperty() seatsPerRow: number;
  @ApiProperty({ description: 'False once the event has started' }) isOpen: boolean;
  @ApiProperty({ type: SeatCountsDto }) seats: SeatCountsDto;
}

export class SeatDto {
  @ApiProperty() row: number;
  @ApiProperty() number: number;
  @ApiProperty({ example: 'C7' }) label: string;
  @ApiProperty({ enum: ['available', 'held', 'booked'] }) status: 'available' | 'held' | 'booked';
  @ApiProperty({ description: "The caller's own held or booked seat" }) mine: boolean;
}

export class SeatRefViewDto {
  @ApiProperty() row: number;
  @ApiProperty() number: number;
  @ApiProperty() label: string;
}

export class MyHoldDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'date-time' }) expiresAt: Date;
  @ApiProperty({ type: SeatRefViewDto, isArray: true }) seats: SeatRefViewDto[];
}

export class SeatMapDto {
  @ApiProperty({ type: EventViewDto }) event: EventViewDto;
  @ApiProperty({ format: 'date-time', description: 'Lets the client correct its countdown for clock drift' }) serverTime: Date;
  @ApiProperty() maxSeatsPerBooking: number;
  @ApiProperty() holdDurationMinutes: number;
  @ApiProperty({ type: SeatDto, isArray: true }) seats: SeatDto[];
  @ApiPropertyOptional({ type: MyHoldDto, nullable: true }) myHold: MyHoldDto | null;
}
