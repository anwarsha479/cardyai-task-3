import { useEffect, useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { api, ApiError } from '../api/client';
import type { SettingView } from '../api/types';
import { PageHeader } from '../components/PageHeader';
import { brand, ink, seatColors } from '../theme';

const COPY: Record<SettingView['key'], { label: string; help: string; unit: string }> = {
  holdDurationMinutes: {
    label: 'Seat hold duration',
    help: 'How long selected seats stay held while an attendee confirms. Holds already made keep their time.',
    unit: 'min',
  },
  maxSeatsPerBooking: {
    label: 'Maximum seats per booking',
    help: 'How many seats an attendee can hold and book at once.',
    unit: 'seats',
  },
};

/** The draft value when it is a valid number in range, otherwise the saved value. */
function valueOf(settings: SettingView[], draft: Record<string, string>, key: SettingView['key']): number {
  const s = settings.find((x) => x.key === key)!;
  const n = Number(draft[key]);
  return Number.isInteger(n) && n >= s.min && n <= s.max ? n : s.value;
}

const PREVIEW_SEATS = 10;

/** Shows the rules as an attendee will experience them, using the values being edited. */
function AttendeePreview({ holdMinutes, maxSeats, unsaved }: { holdMinutes: number; maxSeats: number; unsaved: boolean }) {
  return (
    <Box
      sx={{
        borderRadius: 3.5,
        p: 3,
        color: '#fff',
        bgcolor: ink[950],
        backgroundImage: `radial-gradient(360px 220px at 100% 0%, ${alpha(brand.main, 0.3)}, transparent 70%)`,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Typography variant="overline" sx={{ color: brand.light, lineHeight: 1.4 }}>
          What attendees see
        </Typography>
        {unsaved && <Chip size="small" label="Unsaved" sx={{ bgcolor: alpha('#FCD34D', 0.16), color: '#FCD34D' }} />}
      </Stack>

      <Stack direction="row" spacing={2.5} alignItems="center">
        <Box
          sx={{
            width: 76,
            height: 76,
            flexShrink: 0,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            border: `4px solid ${seatColors.heldMine.bg}`,
            boxShadow: `0 0 24px ${alpha(seatColors.heldMine.bg, 0.35)}`,
          }}
        >
          <Typography fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', color: '#FCD34D' }}>
            {holdMinutes}:00
          </Typography>
        </Box>
        <Typography sx={{ color: alpha('#fff', 0.85) }}>
          Attendees can pick up to <strong>{maxSeats}</strong> {maxSeats === 1 ? 'seat' : 'seats'} and keep them for{' '}
          <strong>
            {holdMinutes} {holdMinutes === 1 ? 'minute' : 'minutes'}
          </strong>{' '}
          while they confirm.
        </Typography>
      </Stack>

      <Box sx={{ mt: 3 }}>
        <Stack direction="row" spacing={0.75} aria-hidden>
          {Array.from({ length: PREVIEW_SEATS }, (_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                aspectRatio: '1',
                maxWidth: 26,
                borderRadius: '6px 6px 3px 3px',
                bgcolor: i < maxSeats ? seatColors.selected.bg : 'transparent',
                border: `1.5px solid ${i < maxSeats ? seatColors.selected.border : alpha('#fff', 0.22)}`,
                boxShadow: i < maxSeats ? `0 0 10px ${alpha(brand.main, 0.5)}` : 'none',
              }}
            />
          ))}
        </Stack>
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: alpha('#fff', 0.55) }}>
          {maxSeats} of {PREVIEW_SEATS} seats selectable in one booking
        </Typography>
      </Box>
    </Box>
  );
}

/** Organizer-only. Changes apply to the very next hold, with no restart (SB-DM-4). */
export function SettingsPage() {
  const [settings, setSettings] = useState<SettingView[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function show(list: SettingView[]) {
    setSettings(list);
    setDraft(Object.fromEntries(list.map((s) => [s.key, String(s.value)])));
  }

  useEffect(() => {
    api<{ settings: SettingView[] }>('/settings')
      .then((res) => show(res.settings))
      .catch((err: unknown) => setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not load settings')));
  }, []);

  const changes = settings
    ? Object.fromEntries(settings.filter((s) => draft[s.key] !== String(s.value)).map((s) => [s.key, Number(draft[s.key])]))
    : {};
  const dirty = Object.keys(changes).length > 0;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    setError(null);
    setSaving(true);
    try {
      const res = await api<{ settings: SettingView[] }>('/settings', { method: 'PATCH', body: changes });
      show(res.settings);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      <PageHeader eyebrow="Organizer" title="Settings" subtitle="Booking rules for every event. Changes apply to the next hold." />
      {!settings && !error && <CircularProgress aria-label="Loading settings" />}
      {error && !Object.keys(error.fieldErrors).length && <Alert severity="error">{error.message}</Alert>}
      {settings && (
        <Box sx={{ display: 'grid', gap: 3, alignItems: 'start', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 400px' } }}>
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack component="form" onSubmit={handleSubmit} noValidate divider={<Divider />} spacing={2.5}>
              {settings.map((s) => {
                const fieldError = error?.fieldErrors[s.key]?.[0];
                const copy = COPY[s.key];
                return (
                  <Stack key={s.key} direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between">
                    <Box>
                      <Typography variant="subtitle1">{copy.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {copy.help} Allowed {s.min}–{s.max}, default {s.defaultValue}.
                      </Typography>
                      {s.updatedBy && (
                        <Typography variant="caption" color="text.secondary">
                          Last changed by {s.updatedBy.name}
                          {s.updatedAt ? ` · ${new Date(s.updatedAt).toLocaleString()}` : ''}
                        </Typography>
                      )}
                    </Box>
                    <TextField
                      type="number"
                      size="small"
                      value={draft[s.key] ?? ''}
                      onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })}
                      error={Boolean(fieldError)}
                      helperText={fieldError}
                      aria-label={copy.label}
                      sx={{ width: { xs: '100%', sm: 160 }, flexShrink: 0 }}
                      slotProps={{
                        htmlInput: { min: s.min, max: s.max, step: 1 },
                        input: { endAdornment: <InputAdornment position="end">{copy.unit}</InputAdornment> },
                      }}
                    />
                  </Stack>
                );
              })}
              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button variant="outlined" disabled={!dirty || saving} onClick={() => settings && show(settings)}>
                  Discard
                </Button>
                <Button type="submit" variant="contained" disabled={!dirty} loading={saving}>
                  Save changes
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        <Stack spacing={3}>
          <AttendeePreview
            holdMinutes={valueOf(settings, draft, 'holdDurationMinutes')}
            maxSeats={valueOf(settings, draft, 'maxSeatsPerBooking')}
            unsaved={dirty}
          />
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ mb: 1.5 }}>
                Good to know
              </Typography>
              <Stack spacing={1.25}>
                {[
                  'Changes apply to the next hold. No restart is needed.',
                  'Holds and bookings already made keep their seats and expiry time.',
                  'Seats free up automatically the moment a hold runs out.',
                ].map((tip) => (
                  <Stack key={tip} direction="row" spacing={1.25} alignItems="flex-start">
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: 18, mt: '2px', color: brand.main }} />
                    <Typography variant="body2" color="text.secondary">
                      {tip}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
        </Box>
      )}
      <Snackbar open={saved} autoHideDuration={3000} onClose={() => setSaved(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setSaved(false)}>
          Settings saved
        </Alert>
      </Snackbar>
    </Stack>
  );
}
