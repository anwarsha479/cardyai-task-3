import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { api, ApiError } from '../api/client';
import type { BookingStatus, BookingView } from '../api/types';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { TicketStub } from '../components/TicketStub';
import { formatDateTime, formatTime } from '../events/format';
import { seatColors } from '../theme';

const STATUS: Record<BookingStatus, { label: string; bg: string; color: string }> = {
  confirmed: { label: 'Confirmed', bg: '#D1FAE5', color: '#065F46' },
  held: { label: 'On hold', bg: '#FEF3C7', color: '#92400E' },
  expired: { label: 'Hold expired', bg: '#F1F5F9', color: '#475569' },
  cancelled: { label: 'Cancelled', bg: '#F1F5F9', color: '#475569' },
};

function isUpcoming(b: BookingView): boolean {
  return (b.status === 'confirmed' || b.status === 'held') && new Date(b.event.startsAt).getTime() > Date.now();
}

function Ticket({ booking, onCancel }: { booking: BookingView; onCancel(): void }) {
  const active = isUpcoming(booking);
  const status = STATUS[booking.status];
  return (
    <Card sx={{ '--ticket-bg': '#fff', display: 'flex', alignItems: 'stretch' }}>
      <TicketStub eventId={booking.event.id} startsAt={booking.event.startsAt} faded={!active} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ flex: 1, minWidth: 0, p: { xs: 2, sm: 2.5 }, pl: { xs: 2.5, sm: 3 } }} justifyContent="space-between">
        <Stack spacing={1.25} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography component={RouterLink} to={`/events/${booking.event.id}`} variant="subtitle1" sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
              {booking.event.name}
            </Typography>
            <Chip size="small" label={status.label} sx={{ bgcolor: status.bg, color: status.color }} />
          </Stack>
          <Stack direction="row" columnGap={2} rowGap={0.5} flexWrap="wrap" sx={{ color: 'text.secondary' }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AccessTimeRoundedIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2">{formatTime(booking.event.startsAt)}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <PlaceOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2">{booking.event.venue}</Typography>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {booking.seats.map((s) => (
              <Box
                key={s.label}
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  bgcolor: active ? seatColors.bookedMine.bg : '#F1F5F9',
                  color: active ? '#fff' : 'text.secondary',
                  textDecoration: booking.status === 'cancelled' ? 'line-through' : 'none',
                }}
              >
                {s.label}
              </Box>
            ))}
          </Stack>
        </Stack>
        <Stack alignItems={{ xs: 'flex-start', sm: 'flex-end' }} justifyContent="space-between" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Box sx={{ textAlign: { sm: 'right' } }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', letterSpacing: '0.08em', fontWeight: 700 }}>
              REF {booking.id.slice(0, 8).toUpperCase()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {booking.status === 'cancelled' && booking.cancelledAt
                ? `Cancelled ${formatDateTime(booking.cancelledAt)}`
                : `Booked ${formatDateTime(booking.confirmedAt ?? booking.createdAt)}`}
            </Typography>
          </Box>
          {booking.status === 'confirmed' && active && (
            <Button variant="outlined" color="error" size="small" onClick={onCancel} sx={{ borderColor: 'divider' }}>
              Cancel booking
            </Button>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

export function MyBookingsPage() {
  const [bookings, setBookings] = useState<BookingView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<BookingView | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<BookingView[]>('/bookings')
      .then(setBookings)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load your bookings'));
  }, []);

  useEffect(load, [load]);

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/bookings/${cancelling.id}/cancel`, { method: 'POST' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel the booking');
    } finally {
      setBusy(false);
      setCancelling(null);
      load();
    }
  }

  const upcoming = bookings?.filter(isUpcoming) ?? [];
  const history = bookings?.filter((b) => !isUpcoming(b)) ?? [];
  const section = (title: string, list: BookingView[]) =>
    list.length > 0 && (
      <Stack spacing={1.5}>
        <Typography variant="overline" color="text.secondary">
          {title} · {list.length}
        </Typography>
        {list.map((b) => (
          <Ticket key={b.id} booking={b} onCancel={() => setCancelling(b)} />
        ))}
      </Stack>
    );

  return (
    <Stack spacing={4}>
      <PageHeader eyebrow="Your wallet" title="My tickets" subtitle="Every booking and hold you have made, newest first." />
      {error && <Alert severity="error">{error}</Alert>}
      {!bookings && !error && (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: 3.5 }} />
          ))}
        </Stack>
      )}
      {bookings?.length === 0 && (
        <EmptyState
          icon={<ConfirmationNumberOutlinedIcon />}
          title="No tickets yet"
          message="Pick an event and choose your seats."
          action={
            <Button component={RouterLink} to="/events" variant="contained">
              Browse events
            </Button>
          }
        />
      )}
      {section('Upcoming', upcoming)}
      {section('History', history)}
      <Dialog open={Boolean(cancelling)} onClose={() => setCancelling(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel this booking?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Seats <strong>{cancelling?.seats.map((s) => s.label).join(', ')}</strong> for {cancelling?.event.name} are released straight away, and anyone
            can book them. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={() => setCancelling(null)}>
            Keep booking
          </Button>
          <Button color="error" variant="contained" onClick={confirmCancel} loading={busy}>
            Cancel booking
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
