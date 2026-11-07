import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { brand } from '../theme';

interface Props {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}

export function PageHeader({ title, eyebrow, subtitle, actions, back }: Props) {
  return (
    <Stack spacing={1}>
      {back && (
        <Box>
          <Button component={RouterLink} to={back.to} size="small" startIcon={<ArrowBackRoundedIcon />} sx={{ ml: -1.5, color: 'text.secondary' }}>
            {back.label}
          </Button>
        </Box>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} gap={2}>
        <Box sx={{ minWidth: 0 }}>
          {eyebrow && (
            <Typography variant="overline" sx={{ color: brand.dark }}>
              {eyebrow}
            </Typography>
          )}
          <Typography variant="h4" component="h1">
            {title}
          </Typography>
          {subtitle && (
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Stack direction="row" spacing={1} flexShrink={0} alignItems="center">
            {actions}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}
