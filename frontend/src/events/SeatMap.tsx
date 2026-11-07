import { Box, ButtonBase, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import type { Seat } from '../api/types';
import { brand, seatColors } from '../theme';

const SEAT = { xs: 18, sm: 28, md: 30 };
const GAP = { xs: 0.375, sm: 0.75 };

type Look = keyof typeof seatColors;

function lookOf(seat: Seat, selected: boolean): Look {
  if (selected) return 'selected';
  if (seat.status === 'held') return seat.mine ? 'heldMine' : 'held';
  if (seat.status === 'booked') return seat.mine ? 'bookedMine' : 'booked';
  return 'available';
}

const LABEL: Record<Look, string> = {
  available: 'Available',
  selected: 'Your selection',
  held: 'Held',
  heldMine: 'Held for you',
  booked: 'Booked',
  bookedMine: 'Your ticket',
};

function seatSx(look: Look) {
  const c = seatColors[look];
  return {
    bgcolor: c.bg,
    color: c.text,
    border: `1.5px solid ${c.border}`,
    ...(look === 'held' && { backgroundImage: `repeating-linear-gradient(135deg, transparent 0 3px, ${alpha(c.border, 0.28)} 3px 5px)` }),
    ...(look === 'selected' && { boxShadow: `0 0 0 3px ${alpha(brand.main, 0.22)}` }),
  };
}

export function SeatLegend({ showMine }: { showMine: boolean }) {
  const looks: Look[] = showMine ? ['available', 'selected', 'heldMine', 'held', 'booked', 'bookedMine'] : ['available', 'held', 'booked'];
  return (
    <Stack direction="row" flexWrap="wrap" columnGap={2.25} rowGap={1} justifyContent="center">
      {looks.map((look) => (
        <Stack key={look} direction="row" spacing={0.875} alignItems="center">
          <Box sx={{ width: 14, height: 14, borderRadius: '4px 4px 2px 2px', ...seatSx(look), boxShadow: 'none' }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            {LABEL[look]}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

interface Props {
  seats: Seat[];
  seatsPerRow: number;
  selected: Set<string>;
  interactive: boolean;
  onToggle(seat: Seat): void;
}

/** The interface only offers available seats; the server decides who gets them (SB-DM-3). */
export function SeatMap({ seats, seatsPerRow, selected, interactive, onToggle }: Props) {
  const rows: Seat[][] = [];
  for (let i = 0; i < seats.length; i += seatsPerRow) rows.push(seats.slice(i, i + seatsPerRow));
  const aisleAfter = seatsPerRow >= 8 ? Math.ceil(seatsPerRow / 2) : 0;
  const rowLetter = (row: Seat[]) => row[0]?.label.replace(/\d+$/, '');
  const rowLabel = (letter?: string) => (
    <Typography variant="caption" sx={{ width: { xs: 12, sm: 18 }, textAlign: 'center', fontWeight: 700, fontSize: { xs: 10, sm: 12 }, color: 'text.secondary', flexShrink: 0 }}>
      {letter}
    </Typography>
  );

  return (
    <Box sx={{ overflowX: 'auto', pb: 1 }}>
      <Stack spacing={GAP} alignItems="center" sx={{ minWidth: 'fit-content', mx: 'auto', px: { xs: 0, sm: 1 } }}>
        <Box sx={{ width: '86%', minWidth: 200, mb: { xs: 2.5, sm: 4 }, textAlign: 'center' }}>
          <Box
            sx={{
              height: 10,
              borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
              background: `linear-gradient(180deg, ${brand.main} 0%, ${alpha(brand.main, 0.15)} 100%)`,
              boxShadow: `0 10px 28px ${alpha(brand.main, 0.35)}`,
            }}
          />
          <Typography variant="overline" sx={{ display: 'block', mt: 1, color: 'text.secondary', fontSize: '0.68rem' }}>
            Stage
          </Typography>
        </Box>
        {rows.map((row) => (
          <Stack key={rowLetter(row)} direction="row" spacing={GAP} useFlexGap alignItems="center">
            {rowLabel(rowLetter(row))}
            {row.map((seat) => {
              const look = lookOf(seat, selected.has(seat.label));
              const clickable = interactive && (seat.status === 'available' || look === 'selected');
              return (
                <Box key={seat.label} sx={{ display: 'flex', ml: aisleAfter && seat.number === aisleAfter + 1 ? { xs: 0.75, sm: 2.5 } : 0 }}>
                  <Tooltip title={`${seat.label} · ${LABEL[look]}`} disableInteractive>
                    <span>
                      <ButtonBase
                        onClick={() => onToggle(seat)}
                        disabled={!clickable}
                        aria-label={`Seat ${seat.label}, ${LABEL[look]}`}
                        aria-pressed={look === 'selected'}
                        sx={(t) => ({
                          width: SEAT,
                          height: SEAT,
                          borderRadius: { xs: '5px 5px 3px 3px', sm: '8px 8px 4px 4px' },
                          fontSize: { xs: 8, sm: 10.5 },
                          fontWeight: 700,
                          transition: 'transform 90ms, box-shadow 120ms, border-color 120ms',
                          ...seatSx(look),
                          ...(clickable &&
                            look === 'available' && {
                              '&:hover': { borderColor: brand.main, color: brand.dark, transform: 'translateY(-2px)', boxShadow: `0 4px 10px ${alpha(brand.main, 0.25)}` },
                            }),
                          '&.Mui-disabled': { cursor: 'default' },
                          '&.Mui-focusVisible': { outline: `2px solid ${t.palette.secondary.main}`, outlineOffset: 2 },
                        })}
                      >
                        {look === 'bookedMine' ? <CheckRoundedIcon sx={{ fontSize: { xs: 13, sm: 16 } }} /> : seat.number}
                      </ButtonBase>
                    </span>
                  </Tooltip>
                </Box>
              );
            })}
            {rowLabel(rowLetter(row))}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
