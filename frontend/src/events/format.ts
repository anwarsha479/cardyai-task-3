const dateTime = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const longDate = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

export function formatLongDate(iso: string): string {
  return longDate.format(new Date(iso));
}

/** Parts for a ticket-style date stub: "NOV", "25", "Wed". */
export function dateStub(iso: string): { month: string; day: string; weekday: string } {
  const d = new Date(iso);
  return {
    month: d.toLocaleString(undefined, { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
    weekday: d.toLocaleString(undefined, { weekday: 'short' }),
  };
}

const ACCENTS = [
  ['#0D9488', '#0F766E'],
  ['#7C3AED', '#5B21B6'],
  ['#E11D48', '#9F1239'],
  ['#0284C7', '#075985'],
  ['#D97706', '#92400E'],
  ['#4F46E5', '#3730A3'],
];

/** A stable accent gradient per event, so each event keeps its colour everywhere. */
export function eventAccent(id: string): string {
  const hash = [...id].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const [from, to] = ACCENTS[hash % ACCENTS.length];
  return `linear-gradient(150deg, ${from} 0%, ${to} 100%)`;
}

/** ISO instant → value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (viewer's time zone) → ISO instant with "Z". */
export function fromLocalInput(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
