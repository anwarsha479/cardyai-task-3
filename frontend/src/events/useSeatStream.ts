import { useEffect, useRef, useState } from 'react';
import { readEventStream } from '../api/client';

const RECONNECT_MS = 2000;

export type StreamState = 'connecting' | 'live' | 'offline';

type Message = { type: 'ready' | 'changed' | 'ping'; eventId?: string };

/** Calls `onChange` when the stream connects (or reconnects) and whenever a seat on the event changes. */
export function useSeatStream(eventId: string, onChange: () => void): StreamState {
  const [state, setState] = useState<StreamState>('connecting');
  const callback = useRef(onChange);
  callback.current = onChange;

  useEffect(() => {
    const abort = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      setState('connecting');
      readEventStream<Message>(
        `/events/${eventId}/seats/stream`,
        (message) => {
          if (message.type === 'ready') setState('live');
          if (message.type === 'ready' || message.type === 'changed') callback.current();
        },
        abort.signal,
      )
        .catch(() => undefined)
        .finally(() => {
          if (abort.signal.aborted) return;
          setState('offline');
          retry = setTimeout(connect, RECONNECT_MS);
        });
    };
    connect();

    return () => {
      abort.abort();
      clearTimeout(retry);
    };
  }, [eventId]);

  return state;
}
