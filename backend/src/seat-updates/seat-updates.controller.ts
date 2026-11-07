import { Controller, MessageEvent, Param, ParseUUIDPipe, Sse } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { AppError } from '../common/exceptions/app-error';
import { Event } from '../events/entities/event.entity';
import { SeatUpdatesService } from './seat-updates.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class SeatUpdatesController {
  constructor(
    private readonly updates: SeatUpdatesService,
    @InjectRepository(Event) private readonly events: Repository<Event>,
  ) {}

  @Sse(':id/seats/stream')
  @ApiOkResponse({ description: 'text/event-stream of { type: "ready" | "changed" | "ping" } messages' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  async stream(@Param('id', ParseUUIDPipe) id: string): Promise<Observable<MessageEvent>> {
    if (!(await this.events.existsBy({ id }))) throw AppError.notFound('Event');
    return this.updates.stream(id);
  }
}
