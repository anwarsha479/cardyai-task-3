import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, Chip, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import EventSeatOutlinedIcon from '@mui/icons-material/EventSeatOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import StadiumOutlinedIcon from '@mui/icons-material/StadiumOutlined';
import { api, ApiError } from '../api/client';
import type { EventView } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { TicketStub } from '../components/TicketStub';
import { brand } from '../theme';
import { EventFormDialog } from './EventFormDialog';
import { formatLongDate, formatTime } from './format';

function Availability({ event }: { event: EventView }) {
  const { capacity, available } = event.seats;
  if (!event.isOpen) return <Chip size="small" label="Started" />;
  if (available === 0) return <Chip size="small" color="error" label="Sold out" />;
  if (available / capacity <= 0.15) return <Chip size="small" color="warning" label={`Only ${available} left`} />;
  return <Chip size="small" sx={{ bgcolor: brand.soft, color: brand.dark }} label={`${available} available`} />;
}

function EventRow({ event, organizer }: { event: EventView; organizer: boolean }) {
  const { capacity, booked, held } = event.seats;
  const taken = Math.round(((booked + held) / capacity) * 100);
  const to = `/events/${event.id}`;
  return (
    <Card sx={{ '--ticket-bg': '#fff', display: 'flex', alignItems: 'stretch', transition: 'box-shadow 160ms', '&:hover': { boxShadow: '0 10px 28px rgba(11,16,32,0.09)' } }}>
      <TicketStub eventId={event.id} startsAt={event.startsAt} faded={!event.isOpen} />
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'grid',
          gap: { xs: 2, md: 4 },
          alignItems: 'center',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 260px auto' },
          p: { xs: 2, sm: 2.5, md: 3 },
          pl: { xs: 2.5, md: 4 },
        }}
      >
        <Stack spacing={1} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography component={RouterLink} to={to} variant="h6" sx={{ color: 'text.primary', textDecoration: 'none', lineHeight: 1.25, '&:hover': { textDecoration: 'underline' } }}>
              {event.name}
            </Typography>
            <Availability event={event} />
          </Stack>
          <Stack direction="row" columnGap={2.5} rowGap={0.5} flexWrap="wrap" sx={{ color: 'text.secondary' }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <AccessTimeRoundedIcon sx={{ fontSize: 17 }} />
              <Typography variant="body2">
                {formatLongDate(event.startsAt)}, {formatTime(event.startsAt)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
              <PlaceOutlinedIcon sx={{ fontSize: 17 }} />
              <Typography variant="body2" noWrap>
                {event.venue}
              </Typography>
            </Stack>
          </Stack>
          {event.description && (
            <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 720 }}>
              {event.description}
            </Typography>
          )}
        </Stack>

        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              {taken}% taken
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {capacity} seats
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" color="secondary" value={taken} aria-label={`${taken}% of seats taken`} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {booked} booked · {held} held
          </Typography>
        </Box>

        <Button
          component={RouterLink}
          to={to}
          variant={organizer || !event.isOpen ? 'outlined' : 'contained'}
          endIcon={<ArrowForwardRoundedIcon />}
          sx={{ justifySelf: { xs: 'stretch', md: 'end' }, whiteSpace: 'nowrap' }}
        >
          {organizer || !event.isOpen ? 'View seating' : 'Choose seats'}
        </Button>
      </Box>
    </Card>
  );
}

function Summary({ events }: { events: EventView[] }) {
  const open = events.filter((e) => e.isOpen);
  const seats = open.reduce((sum, e) => sum + e.seats.available, 0);
  const items = [
    { label: 'Upcoming events', value: open.length, icon: <StadiumOutlinedIcon fontSize="small" /> },
    { label: 'Seats open', value: seats, icon: <EventSeatOutlinedIcon fontSize="small" /> },
  ];
  return (
    <Stack direction="row" spacing={1.5}>
      {items.map((item) => (
        <Stack key={item.label} direction="row" spacing={1.25} alignItems="center" sx={{ px: 2, py: 1, borderRadius: 2.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
          <Box sx={{ color: brand.dark, display: 'grid' }}>{item.icon}</Box>
          <Box>
            <Typography fontWeight={800} lineHeight={1.1}>
              {item.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.label}
            </Typography>
          </Box>
        </Stack>
      ))}
    </Stack>
  );
}

export function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const isOrganizer = user?.role === 'organizer';

  useEffect(() => {
    api<EventView[]>('/events')
      .then(setEvents)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : 'Could not load events'));
  }, []);

  return (
    <Stack spacing={3.5}>
      <PageHeader
        eyebrow={isOrganizer ? 'Organizer' : 'Upcoming'}
        title="Events"
        subtitle={isOrganizer ? 'Set up events and watch seats fill up in real time.' : 'Pick an event to choose your seats.'}
        actions={
          <>
            {events && events.length > 0 && (
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Summary events={events} />
              </Box>
            )}
            {isOrganizer && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreating(true)}>
                New event
              </Button>
            )}
          </>
        }
      />
      {error && <Alert severity="error">{error}</Alert>}
      {!events && !error && (
        <Stack spacing={2}>
          {[0, 1].map((i) => (
            <Skeleton key={i} variant="rounded" height={132} sx={{ borderRadius: 3.5 }} />
          ))}
        </Stack>
      )}
      {events?.length === 0 && (
        <EmptyState
          icon={<StadiumOutlinedIcon />}
          title="No events yet"
          message={isOrganizer ? 'Create your first event to open it for booking.' : 'Check back soon.'}
          action={
            isOrganizer && (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCreating(true)}>
                New event
              </Button>
            )
          }
        />
      )}
      {events && events.length > 0 && (
        <Stack spacing={2}>
          {events.map((event) => (
            <EventRow key={event.id} event={event} organizer={isOrganizer} />
          ))}
        </Stack>
      )}
      <EventFormDialog open={creating} onClose={() => setCreating(false)} onSaved={(saved) => navigate(`/events/${saved.id}`)} />
    </Stack>
  );
}
