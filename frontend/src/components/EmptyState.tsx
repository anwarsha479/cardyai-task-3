import type { ReactNode } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';
import { brand, tint } from '../theme';

interface Props {
  icon: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: Props) {
  return (
    <Card sx={{ borderStyle: 'dashed', boxShadow: 'none' }}>
      <Stack alignItems="center" spacing={1.5} sx={{ py: 6, px: 3, textAlign: 'center' }}>
        <Box sx={{ width: 56, height: 56, borderRadius: 3, display: 'grid', placeItems: 'center', color: brand.dark, bgcolor: tint(brand.main) }}>
          {icon}
        </Box>
        <Typography variant="subtitle1">{title}</Typography>
        {message && (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
            {message}
          </Typography>
        )}
        {action && <Box sx={{ pt: 1 }}>{action}</Box>}
      </Stack>
    </Card>
  );
}
