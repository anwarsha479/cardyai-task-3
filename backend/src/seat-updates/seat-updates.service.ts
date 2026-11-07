import { Injectable, MessageEvent } from '@nestjs/common';
import { filter, interval, map, merge, Observable, of, Subject } from 'rxjs';

export const STREAM_PING_MS = 25_000;

export type SeatStreamMessage = { type: 'ready' | 'changed'; eventId: string } | { type: 'ping' };

/** In-process change bus (A-05): bookings publish after each commit, the seat-map stream listens. */
@Injectable()
export class SeatUpdatesService {
  private readonly changes = new Subject<string>();

  publish(...eventIds: string[]): void {
    for (const id of new Set(eventIds)) this.changes.next(id);
  }

  stream(eventId: string): Observable<MessageEvent> {
    const messages: Observable<SeatStreamMessage> = merge(
      of({ type: 'ready' as const, eventId }),
      this.changes.pipe(
        filter((id) => id === eventId),
        map(() => ({ type: 'changed' as const, eventId })),
      ),
      interval(STREAM_PING_MS).pipe(map(() => ({ type: 'ping' as const }))),
    );
    return messages.pipe(map((data) => ({ data })));
  }
}
