import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { brand } from '../theme';
import { api, ApiError } from '../api/client';
import type { EventInput, EventView } from '../api/types';
import { fromLocalInput, toLocalInput } from './format';

interface Props {
  open: boolean;
  event?: EventView;
  onClose(): void;
  onSaved(event: EventView): void;
}

interface Draft {
  name: string;
  description: string;
  venue: string;
  startsAt: string;
  seatRows: string;
  seatsPerRow: string;
}

const EMPTY: Draft = { name: '', description: '', venue: '', startsAt: '', seatRows: '10', seatsPerRow: '12' };

function draftOf(event?: EventView): Draft {
  if (!event) return EMPTY;
  return {
    name: event.name,
    description: event.description ?? '',
    venue: event.venue,
    startsAt: toLocalInput(event.startsAt),
    seatRows: String(event.seatRows),
    seatsPerRow: String(event.seatsPerRow),
  };
}

/** Create or edit an event. The server checks every rule again, including the future date. */
export function EventFormDialog({ open, event, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(draftOf(event));
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(draftOf(event));
      setError(null);
    }
  }, [open, event]);

  const set = (key: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [key]: e.target.value });
  const fieldError = (key: string) => error?.fieldErrors[key]?.[0];
  const rows = Number(draft.seatRows);
  const perRow = Number(draft.seatsPerRow);
  const capacity = Number.isInteger(rows) && Number.isInteger(perRow) && rows > 0 && perRow > 0 ? rows * perRow : 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body: EventInput = {
      name: draft.name,
      description: draft.description || null,
      venue: draft.venue,
      startsAt: fromLocalInput(draft.startsAt),
      seatRows: Number(draft.seatRows),
      seatsPerRow: Number(draft.seatsPerRow),
    };
    try {
      const saved = event
        ? await api<EventView>(`/events/${event.id}`, { method: 'PATCH', body })
        : await api<EventView>('/events', { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not save the event'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle>
          {event ? 'Edit event' : 'New event'}
          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {event ? 'Changes are visible to attendees straight away.' : 'Attendees can book as soon as you create it.'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && !Object.keys(error.fieldErrors).length && <Alert severity="error">{error.message}</Alert>}
            <Typography variant="overline" color="text.secondary" sx={{ mb: -1 }}>
              Details
            </Typography>
            <TextField label="Name" value={draft.name} onChange={set('name')} required autoFocus error={Boolean(fieldError('name'))} helperText={fieldError('name')} slotProps={{ htmlInput: { maxLength: 120 } }} />
            <TextField label="Venue" value={draft.venue} onChange={set('venue')} required error={Boolean(fieldError('venue'))} helperText={fieldError('venue')} slotProps={{ htmlInput: { maxLength: 120 } }} />
            <TextField
              label="Starts at"
              type="datetime-local"
              value={draft.startsAt}
              onChange={set('startsAt')}
              required
              error={Boolean(fieldError('startsAt'))}
              helperText={fieldError('startsAt') ?? 'Must be in the future. Your local time.'}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField label="Description" value={draft.description} onChange={set('description')} multiline minRows={2} error={Boolean(fieldError('description'))} helperText={fieldError('description')} slotProps={{ htmlInput: { maxLength: 2000 } }} />
            <Typography variant="overline" color="text.secondary" sx={{ mb: -1 }}>
              Seating
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField label="Rows" type="number" value={draft.seatRows} onChange={set('seatRows')} required fullWidth error={Boolean(fieldError('seatRows'))} helperText={fieldError('seatRows') ?? 'A to Z, up to 26'} slotProps={{ htmlInput: { min: 1, max: 26 } }} />
              <TextField label="Seats per row" type="number" value={draft.seatsPerRow} onChange={set('seatsPerRow')} required fullWidth error={Boolean(fieldError('seatsPerRow'))} helperText={fieldError('seatsPerRow') ?? 'Up to 50'} slotProps={{ htmlInput: { min: 1, max: 50 } }} />
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 2, borderRadius: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
              <Box
                aria-hidden
                sx={{
                  display: 'grid',
                  gap: '2px',
                  gridTemplateColumns: `repeat(${capacity > 0 ? Math.min(perRow, 50) : 1}, 4px)`,
                  maxHeight: 108,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {Array.from({ length: capacity > 0 ? Math.min(capacity, 1300) : 0 }, (_, i) => (
                  <Box key={i} sx={{ width: 4, height: 4, borderRadius: '1px', bgcolor: brand.main, opacity: 0.75 }} />
                ))}
              </Box>
              <Box>
                <Typography variant="subtitle2">{capacity > 0 ? `${capacity} seats` : 'No seats yet'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {capacity > 0 ? `Rows A–${String.fromCharCode(64 + Math.min(rows, 26))}, ${perRow} seats each.` : 'The grid needs at least one row and one seat per row.'}
                  {event && ' Seats that are held or booked cannot be removed.'}
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={saving}>
            {event ? 'Save changes' : 'Create event'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
