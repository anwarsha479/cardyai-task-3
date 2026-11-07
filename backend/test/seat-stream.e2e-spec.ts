import { HoldExpiryService } from '../src/bookings/hold-expiry.service';
import { bearer } from './support/auth-helpers';
import { BookingWorld, createBookingWorld } from './support/booking-world';
import { createEvent, seats } from './support/factories';

interface Stream {
  next(type: string, timeoutMs?: number): Promise<{ type: string; eventId?: string }>;
  received(): { type: string }[];
  close(): void;
}

async function openStream(baseUrl: string, path: string, token: string): Promise<Stream> {
  const abort = new AbortController();
  const response = await fetch(`${baseUrl}${path}`, { headers: bearer(token), signal: abort.signal });
  expect(response.headers.get('content-type')).toContain('text/event-stream');
  const messages: { type: string; eventId?: string }[] = [];
  const waiters: (() => void)[] = [];
  void (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of response.body!) {
        buffer += decoder.decode(chunk as Uint8Array, { stream: true });
        let end: number;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const data = buffer.slice(0, end).split('\n').find((line) => line.startsWith('data:'));
          buffer = buffer.slice(end + 2);
          if (data) messages.push(JSON.parse(data.slice(5)));
          waiters.splice(0).forEach((wake) => wake());
        }
      }
    } catch {
      // Aborted by close().
    }
  })();
  let read = 0;
  return {
    async next(type, timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        while (read < messages.length) {
          const message = messages[read++];
          if (message.type === type) return message;
        }
        if (Date.now() > deadline) throw new Error(`No "${type}" message within ${timeoutMs} ms`);
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          setTimeout(resolve, 100);
        });
      }
    },
    received: () => messages.slice(read),
    close: () => abort.abort(),
  };
}

describe('The seat map stream reports changes made by others', () => {
  let w: BookingWorld;
  let stream: Stream | undefined;

  beforeEach(async () => {
    w = await createBookingWorld();
  });

  afterEach(async () => {
    stream?.close();
    await w.t.close();
  });

  it('T-MAP-02: hold, release, confirm, cancel and expiry each send a change for that event only', async () => {
    const [watcher, actor] = w.attendees;
    const other = await createEvent(w.t.dataSource, w.organizer.user);
    stream = await openStream(await w.t.app.getUrl(), `/api/events/${w.event.id}/seats/stream`, watcher.token);
    expect(await stream.next('ready')).toEqual({ type: 'ready', eventId: w.event.id });
    const auth = bearer(actor.token);

    const first = await w.hold(actor, seats('A1')).expect(201);
    expect(await stream.next('changed')).toEqual({ type: 'changed', eventId: w.event.id });
    await w.api().delete(`/api/holds/${first.body.id}`).set(auth).expect(204);
    await stream.next('changed');

    const second = await w.hold(actor, seats('A2')).expect(201);
    await stream.next('changed');
    await w.api().post(`/api/holds/${second.body.id}/confirm`).set(auth).expect(200);
    await stream.next('changed');
    await w.api().post(`/api/bookings/${second.body.id}/cancel`).set(auth).expect(200);
    await stream.next('changed');

    await w.hold(actor, seats('A3')).expect(201);
    await stream.next('changed');
    w.t.clock.set('2026-03-10T12:05:00Z');
    await w.t.app.get(HoldExpiryService).releaseExpired();
    await stream.next('changed');

    await w.hold(actor, seats('A1'), other.id).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(stream.received().filter((m) => m.type === 'changed')).toEqual([]);
  });

  it('T-MAP-02: an unknown event has no stream', async () => {
    const res = await w.api().get('/api/events/00000000-0000-4000-8000-000000000000/seats/stream').set(bearer(w.attendees[0].token)).expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
