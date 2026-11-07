import { Box, Stack, Typography } from '@mui/material';
import ConfirmationNumberRoundedIcon from '@mui/icons-material/ConfirmationNumberRounded';
import { brand } from '../theme';

/** Logo: a teal ticket badge and the product name. */
export function BrandMark({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: 2,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          background: `linear-gradient(135deg, ${brand.light} -40%, ${brand.main} 45%, ${brand.dark} 100%)`,
          boxShadow: `0 4px 14px ${brand.main}55`,
          transform: 'rotate(-8deg)',
        }}
      >
        <ConfirmationNumberRoundedIcon sx={{ fontSize: 20, transform: 'rotate(8deg)' }} />
      </Box>
      {!compact && (
        <Typography sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1.05rem', color: inverse ? '#fff' : 'text.primary' }}>
          Seatwise
        </Typography>
      )}
    </Stack>
  );
}
