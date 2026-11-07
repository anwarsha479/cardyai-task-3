import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { dateStub, eventAccent } from '../events/format';

/** Coloured date block on the left of a ticket, with a perforated right edge. */
export function TicketStub({ eventId, startsAt, faded = false, footer }: { eventId: string; startsAt: string; faded?: boolean; footer?: ReactNode }) {
  const { month, day, weekday } = dateStub(startsAt);
  return (
    <Box
      sx={{
        position: 'relative',
        flexShrink: 0,
        width: { xs: 84, sm: 104 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.25,
        py: 2,
        color: '#fff',
        background: eventAccent(eventId),
        filter: faded ? 'grayscale(0.85)' : 'none',
        opacity: faded ? 0.7 : 1,
        // Perforation: punched notches along the edge where the stub tears off.
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: -5,
          width: 10,
          backgroundImage: 'radial-gradient(circle at 5px 6px, var(--ticket-bg, #fff) 3.5px, transparent 4px)',
          backgroundSize: '10px 12px',
          backgroundRepeat: 'repeat-y',
        },
      }}
    >
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em', opacity: 0.85 }}>{month}</Typography>
      <Typography sx={{ fontSize: { xs: '2rem', sm: '2.4rem' }, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em' }}>{day}</Typography>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.85 }}>{weekday}</Typography>
      {footer}
    </Box>
  );
}
