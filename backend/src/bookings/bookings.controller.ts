import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { BookingsService } from './bookings.service';
import { BookingViewDto, CreateHoldDto } from './dto/booking.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@Roles(Role.Attendee)
@ApiForbiddenResponse({ description: 'Attendee role required, or the booking belongs to someone else' })
@Controller()
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('events/:id/holds')
  @ApiCreatedResponse({ type: BookingViewDto, description: 'Seats held until holdExpiresAt' })
  @ApiConflictResponse({ description: 'SEAT_UNAVAILABLE, SEAT_LIMIT_EXCEEDED, HOLD_EXISTS, EVENT_CLOSED' })
  hold(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateHoldDto,
  ): Promise<BookingViewDto> {
    return this.bookings.hold(user, eventId, dto);
  }

  @Post('holds/:id/confirm')
  @HttpCode(200)
  @ApiOkResponse({ type: BookingViewDto })
  @ApiConflictResponse({ description: 'HOLD_EXPIRED, INVALID_STATE, EVENT_CLOSED' })
  confirm(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BookingViewDto> {
    return this.bookings.confirm(user, id);
  }

  @Delete('holds/:id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Hold released' })
  @ApiConflictResponse({ description: 'INVALID_STATE' })
  release(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.bookings.release(user, id);
  }

  @Get('bookings')
  @ApiOkResponse({ type: BookingViewDto, isArray: true, description: 'Own bookings, newest first' })
  history(@CurrentUser() user: AuthUser): Promise<BookingViewDto[]> {
    return this.bookings.history(user);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: BookingViewDto })
  @ApiConflictResponse({ description: 'INVALID_STATE, EVENT_CLOSED' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<BookingViewDto> {
    return this.bookings.cancel(user, id);
  }
}
