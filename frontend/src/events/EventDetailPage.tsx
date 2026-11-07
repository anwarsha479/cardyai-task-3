import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import EventSeatOutlinedIcon from '@mui/icons-material/EventSeatOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { api, ApiError } from '../api/client';
import type { BookingView, Seat, SeatMap as SeatMapData } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { brand, ink, seatColors } from '../theme';
import { EventFormDialog } from './EventFormDialog';
import { eventAccent, formatLongDate, formatTime } from './format';
import { HoldPanel } from './HoldPanel';
import { SeatLegend, SeatMap } from './SeatMap';
import { useSeatStream, type StreamState } from './useSeatStream';

type Busy = 'hold' | 'confirm' | 'release' | null;

const STREAM: Record<StreamState, { label: string; color: string }> = {
  live: { label: 'Live', color: '#34D399' },
  connecting: { label: 'Connecting', color: '#CBD5E1' },
  offline: { label: 'Reconnecting', color: '#FBBF24' },
};

function LiveIndicator({ state }: { state: StreamState }) {
  const s = STREAM[state];
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.25, py: 0.5, borderRadius: 999, bgcolor: alpha('#fff', 0.08), border: `1px solid ${alpha('#fff', 0.14)}` }}>
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: s.color,
          boxShadow: `0 0 0 0 ${s.color}`,
          animation: state === 'live' ? 'pulse 2s infinite' : 'none',
          '@keyframes pulse': { '0%': { boxShadow: `0 0 0 0 ${alpha(s.color, 0.6)}` }, '70%': { boxShadow: `0 0 0 8px ${alpha(s.color, 0)}` }, '100%': { boxShadow: `0 0 0 0 ${alpha(s.color, 0)}` } },
        }}
      />
      <Typography variant="caption" fontWeight={700} color="#fff">
        {s.label}
      </Typography>
    </Stack>
  );
}

function Meta({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: alpha('#fff', 0.78) }}>
      {icon}
      <Typography variant="body2" fontWeight={500}>
        {children}
      </Typography>
    </Stack>
  );
}

function BannerStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: { xs: '1.5rem', sm: '1.9rem' }, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', color }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: alpha('#fff', 0.6), fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
  );
}

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const { user } = useAuth();
  const isAttendee = user?.role === 'attendee';
  const [map, setMap] = useState<SeatMapData | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookingView | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [editing, setEditing] = useState(false);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const load = useCallback(async () => {
    try {
      const data = await api<SeatMapData>(`/events/${eventId}/seats`);
      setClockOffset(new Date(data.serverTime).getTime() - Date.now());
      setMap(data);
      const free = new Set(data.seats.filter((s) => s.status === 'available').map((s) => s.label));
      const current = selectedRef.current;
      const kept = [...current].filter((label) => free.has(label));
      if (kept.length < current.size) {
        setSelected(new Set(kept));
        setNotice('Some seats you picked were just taken by someone else.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the seat map');
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);
  const stream = useSeatStream(eventId, () => void load());

  async function run(kind: Exclude<Busy, null>, action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(null);
      await load();
    }
  }

  function toggle(seat: Seat) {
    if (!map) return;
    const next = new Set(selected);
    if (next.has(seat.label)) next.delete(seat.label);
    else if (next.size < map.maxSeatsPerBooking) next.add(seat.label);
    else {
      setNotice(`You can pick up to ${map.maxSeatsPerBooking} seats at a time.`);
      return;
    }
    setNotice(null);
    setSelected(next);
  }

  const hold = () =>
    run('hold', async () => {
      const seats = map!.seats.filter((s) => selected.has(s.label)).map(({ row, number }) => ({ row, number }));
      await api(`/events/${eventId}/holds`, { method: 'POST', body: { seats } });
      setSelected(new Set());
      setBooked(null);
    });

  const confirm = () =>
    run('confirm', async () => {
      setBooked(await api<BookingView>(`/holds/${map!.myHold!.id}/confirm`, { method: 'POST' }));
    });

  const release = () =>
    run('release', async () => {
      await api(`/holds/${map!.myHold!.id}`, { method: 'DELETE' });
    });

  if (!map) {
    return error ? (
      <Alert severity="error">{error}</Alert>
    ) : (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 4 }} />
        <Skeleton variant="rounded" height={420} sx={{ borderRadius: 3.5 }} />
      </Stack>
    );
  }

  const { event } = map;
  const canBook = isAttendee && event.isOpen;
  const selectedLabels = map.seats.filter((s) => selected.has(s.label)).map((s) => s.label);
  const occupancy = Math.round(((event.seats.booked + event.seats.held) / event.seats.capacity) * 100);

  let sidebar: ReactNode;
  if (canBook && map.myHold) {
    sidebar = (
      <HoldPanel
        hold={map.myHold}
        holdDurationMinutes={map.holdDurationMinutes}
        clockOffsetMs={clockOffset}
        busy={busy === 'confirm' || busy === 'release' ? busy : null}
        onConfirm={confirm}
        onRelease={release}
        onExpired={() => {
          setNotice('Your hold expired and the seats were released.');
          void load();
        }}
      />
    );
  } else if (canBook) {
    sidebar = (
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle1">Your selection</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' } }}>
            Pick up to {map.maxSeatsPerBooking} seats. We hold them for {map.holdDurationMinutes} minutes while you confirm.
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ minHeight: 32 }}>
          {selectedLabels.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center' }}>
              No seats selected yet. Tap a seat on the map.
            </Typography>
          ) : (
            selectedLabels.map((label) => (
              <Chip
                key={label}
                label={label}
                onDelete={() => toggle(map.seats.find((s) => s.label === label)!)}
                sx={{ bgcolor: seatColors.selected.bg, color: '#fff', '& .MuiChip-deleteIcon': { color: alpha('#fff', 0.75), '&:hover': { color: '#fff' } } }}
              />
            ))
          )}
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {selectedLabels.length} of {map.maxSeatsPerBooking} seats
          </Typography>
          {selectedLabels.length > 0 && (
            <Button size="small" onClick={() => setSelected(new Set())} sx={{ color: 'text.secondary' }}>
              Clear
            </Button>
          )}
        </Stack>
        <Button variant="contained" size="large" fullWidth disabled={selectedLabels.length === 0 || Boolean(busy)} loading={busy === 'hold'} onClick={hold}>
          {selectedLabels.length === 0 ? 'Select seats to continue' : `Hold ${selectedLabels.length} ${selectedLabels.length === 1 ? 'seat' : 'seats'}`}
        </Button>
      </Stack>
    );
  } else {
    sidebar = (
      <Stack spacing={2}>
        <Typography variant="subtitle1">Occupancy</Typography>
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
            <Typography variant="h4" component="p">
              {occupancy}%
            </Typography>
            <Typography variant="caption" color="text.secondary">
              of {event.seats.capacity} seats taken
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" color="secondary" value={occupancy} aria-label="Occupancy" />
        </Box>
        <Divider />
        {[
          ['Booked', event.seats.booked, seatColors.bookedMine.bg],
          ['Held', event.seats.held, seatColors.heldMine.bg],
          ['Available', event.seats.available, brand.main],
        ].map(([label, value, color]) => (
          <Stack key={label as string} direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color as string }} />
              <Typography variant="body2">{label}</Typography>
            </Stack>
            <Typography variant="body2" fontWeight={700}>
              {value}
            </Typography>
          </Stack>
        ))}
        {!event.isOpen && <Alert severity="info">This event has started. Seats can no longer be booked or cancelled.</Alert>}
        {user?.role === 'organizer' && event.isOpen && (
          <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditing(true)} fullWidth>
            Edit event
          </Button>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          color: '#fff',
          bgcolor: ink[950],
          p: { xs: 2.5, sm: 4 },
          '&::before': { content: '""', position: 'absolute', inset: 0, background: eventAccent(event.id), opacity: 0.55, maskImage: 'linear-gradient(115deg, transparent 35%, #000 100%)' },
        }}
      >
        <Stack spacing={2.5} sx={{ position: 'relative' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Button component={RouterLink} to="/events" size="small" startIcon={<ArrowBackRoundedIcon />} sx={{ ml: -1, color: alpha('#fff', 0.75), '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.08) } }}>
              All events
            </Button>
            <LiveIndicator state={stream} />
          </Stack>
          <Box>
            <Typography variant="h3" component="h1" sx={{ fontSize: { xs: '1.75rem', sm: '2.4rem' }, lineHeight: 1.1 }}>
              {event.name}
            </Typography>
            <Stack direction="row" columnGap={2.5} rowGap={0.75} flexWrap="wrap" sx={{ mt: 1.5 }}>
              <Meta icon={<CalendarTodayRoundedIcon sx={{ fontSize: 16 }} />}>{formatLongDate(event.startsAt)}</Meta>
              <Meta icon={<AccessTimeRoundedIcon sx={{ fontSize: 17 }} />}>{formatTime(event.startsAt)}</Meta>
              <Meta icon={<PlaceOutlinedIcon sx={{ fontSize: 17 }} />}>{event.venue}</Meta>
            </Stack>
            {event.description && (
              <Typography sx={{ mt: 2, maxWidth: 640, color: alpha('#fff', 0.7) }} variant="body2">
                {event.description}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={{ xs: 3, sm: 5 }} sx={{ pt: 0.5 }}>
            <BannerStat label="Available" value={event.seats.available} color="#fff" />
            <BannerStat label="Held now" value={event.seats.held} color="#FCD34D" />
            <BannerStat label="Booked" value={event.seats.booked} color={brand.light} />
          </Stack>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="warning" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {booked && (
        <Alert
          severity="success"
          icon={<CheckCircleRoundedIcon />}
          action={
            <Button component={RouterLink} to="/bookings" color="inherit" size="small">
              View tickets
            </Button>
          }
        >
          You're booked: {booked.seats.map((s) => s.label).join(', ')}.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <EventSeatOutlinedIcon sx={{ color: 'text.secondary' }} fontSize="small" />
                <Typography variant="subtitle1">Seating plan</Typography>
                <Typography variant="body2" color="text.secondary">
                  · {event.seatRows} rows × {event.seatsPerRow} seats
                </Typography>
              </Stack>
              <SeatMap seats={map.seats} seatsPerRow={event.seatsPerRow} selected={selected} interactive={canBook && !map.myHold && !busy} onToggle={toggle} />
              <Divider />
              <SeatLegend showMine={isAttendee} />
            </Stack>
          </CardContent>
        </Card>
        <Card
          sx={{
            position: 'sticky',
            top: { md: 24 },
            bottom: { xs: 12, md: 'auto' },
            zIndex: 2,
            boxShadow: { xs: '0 12px 32px rgba(11,16,32,0.16)', md: '0 1px 2px rgba(11,16,32,0.04)' },
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>{sidebar}</CardContent>
        </Card>
      </Box>

      <EventFormDialog
        open={editing}
        event={event}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void load();
        }}
      />
    </Stack>
  );
}
