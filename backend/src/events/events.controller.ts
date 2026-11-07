import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto';
import { EventViewDto, SeatMapDto } from './dto/event-view.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @ApiOkResponse({ type: EventViewDto, isArray: true, description: 'Upcoming events first, with seat counts' })
  list(): Promise<EventViewDto[]> {
    return this.events.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: EventViewDto })
  @ApiNotFoundResponse({ description: 'Event not found' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<EventViewDto> {
    return this.events.get(id);
  }

  @Post()
  @Roles(Role.Organizer)
  @ApiCreatedResponse({ type: EventViewDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR, e.g. a start time that is not in the future' })
  @ApiForbiddenResponse({ description: 'Organizer role required' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto): Promise<EventViewDto> {
    return this.events.create(user, dto);
  }

  @Patch(':id')
  @Roles(Role.Organizer)
  @ApiOkResponse({ type: EventViewDto })
  @ApiConflictResponse({ description: 'SEATS_IN_USE (grid would drop a held or booked seat), EVENT_CLOSED' })
  @ApiForbiddenResponse({ description: 'Organizer role required' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto): Promise<EventViewDto> {
    return this.events.update(id, dto);
  }

  @Get(':id/seats')
  @ApiOkResponse({ type: SeatMapDto })
  @ApiNotFoundResponse({ description: 'Event not found' })
  seatMap(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<SeatMapDto> {
    return this.events.seatMap(user, id);
  }
}
