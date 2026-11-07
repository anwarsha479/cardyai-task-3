import { useEffect, useState } from 'react';
import { Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import type { SeatMap } from '../api/types';
import { seatColors } from '../theme';
import { formatCountdown } from './format';

interface Props {
  hold: NonNullable<SeatMap['myHold']>;
  holdDurationMinutes: number;
  /** server time − client time, so the countdown follows the server's clock. */
  clockOffsetMs: number;
  busy: 'confirm' | 'release' | null;
  onConfirm(): void;
  onRelease(): void;
  onExpired(): void;
}

export function HoldPanel({ hold, holdDurationMinutes, clockOffsetMs, busy, onConfirm, onRelease, onExpired }: Props) {
  const expiresAt = new Date(hold.expiresAt).getTime();
  const remaining = () => expiresAt - (Date.now() + clockOffsetMs);
  const [left, setLeft] = useState(remaining);

  useEffect(() => {
    const tick = () => {
      const ms = remaining();
      setLeft(ms);
      if (ms <= 0) onExpired();
      return ms;
    };
    if (tick() <= 0) return;
    const timer = setInterval(() => {
      if (tick() <= 0) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [expiresAt, clockOffsetMs]);

  const total = holdDurationMinutes * 60_000;
  const urgent = left < 60_000;
  const color = urgent ? 'error' : 'warning';
  const percent = Math.max(0, Math.min(100, (left / total) * 100));

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }} aria-live="polite">
          <CircularProgress variant="determinate" value={100} size={72} thickness={3.5} sx={{ color: 'divider', position: 'absolute', inset: 0 }} />
          <CircularProgress
            variant="determinate"
            value={percent}
            size={72}
            thickness={3.5}
            color={color}
            sx={{ position: 'absolute', inset: 0, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }}
          />
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <Typography fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums', color: `${color}.main` }}>
              {formatCountdown(left)}
            </Typography>
          </Box>
        </Box>
        <Box>
          <Typography variant="subtitle1">Seats held for you</Typography>
          <Typography variant="body2" color="text.secondary">
            Confirm before the timer ends, or they go back on sale.
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {hold.seats.map((s) => (
          <Chip key={s.label} label={s.label} sx={{ bgcolor: seatColors.heldMine.bg, color: '#fff' }} />
        ))}
      </Stack>
      <Stack spacing={1}>
        <Button variant="contained" color="secondary" size="large" onClick={onConfirm} loading={busy === 'confirm'} disabled={Boolean(busy) || left <= 0} fullWidth>
          Confirm {hold.seats.length} {hold.seats.length === 1 ? 'seat' : 'seats'}
        </Button>
        <Button variant="outlined" onClick={onRelease} loading={busy === 'release'} disabled={Boolean(busy)} fullWidth>
          Release seats
        </Button>
      </Stack>
    </Stack>
  );
}
