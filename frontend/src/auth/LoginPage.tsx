import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ApiError } from '../api/client';
import { BrandMark } from '../components/BrandMark';
import { brand, ink, seatColors } from '../theme';
import { useAuth } from './AuthContext';

const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD;

/** Accounts created by `npm run seed`. */
const DEMO_ACCOUNTS = [
  { role: 'Organizer', email: 'organizer@example.test', note: 'Create and edit events, settings' },
  { role: 'Attendee', email: 'attendee1@example.test', note: 'Also attendee2 … attendee12' },
];

function DemoAccounts({ onUse }: { onUse(email: string): void }) {
  return (
    <Box sx={{ borderRadius: 2.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.25, bgcolor: alpha(brand.main, 0.06), borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="overline" sx={{ color: brand.dark, lineHeight: 1.4 }}>
          Demo accounts
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Password{' '}
          <Box component="code" sx={{ px: 0.75, py: 0.25, borderRadius: 1, bgcolor: 'background.default', border: 1, borderColor: 'divider', fontWeight: 700, color: 'text.primary' }}>
            {DEMO_PASSWORD}
          </Box>
        </Typography>
      </Stack>
      {DEMO_ACCOUNTS.map((account, i) => (
        <Stack
          key={account.email}
          direction="row"
          spacing={1.5}
          alignItems="center"
          sx={{ px: 2, py: 1.25, borderTop: i > 0 ? 1 : 0, borderColor: 'divider' }}
        >
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="baseline">
              <Typography variant="body2" fontWeight={700}>
                {account.role}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {account.email}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {account.note}
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={() => onUse(account.email)} aria-label={`Fill in the ${account.role.toLowerCase()} demo account`}>
            Use
          </Button>
        </Stack>
      ))}
    </Box>
  );
}

const ROWS = 7;
const COLS = 12;
const TAKEN = new Set(['0-4', '0-5', '1-1', '1-2', '1-8', '2-6', '2-7', '3-0', '3-3', '3-10', '3-11', '4-5', '5-2', '5-8', '5-9', '6-4']);
const HELD = new Set(['2-2', '2-3', '4-9']);
const PICKED = new Set(['4-6', '4-7']);

/** Decorative seat grid for the welcome panel. */
function SeatIllustration() {
  return (
    <Box aria-hidden sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: 300, maxWidth: '100%', flexShrink: 0, '@media (max-height: 560px)': { display: 'none' } }}>
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const key = `${Math.floor(i / COLS)}-${i % COLS}`;
        const look = PICKED.has(key) ? seatColors.selected : HELD.has(key) ? seatColors.heldMine : TAKEN.has(key) ? null : undefined;
        return (
          <Box
            key={key}
            sx={{
              aspectRatio: '1',
              borderRadius: '5px 5px 2px 2px',
              bgcolor: look ? look.bg : look === null ? alpha('#fff', 0.14) : 'transparent',
              border: `1.5px solid ${look ? look.border : alpha('#fff', look === null ? 0 : 0.22)}`,
              boxShadow: PICKED.has(key) ? `0 0 16px ${brand.main}` : 'none',
            }}
          />
        );
      })}
    </Box>
  );
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'UNKNOWN', 'Sign in failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (field: string) => error?.fieldErrors[field]?.[0];

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        height: { md: '100dvh' },
        overflow: { md: 'hidden' },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
        bgcolor: 'background.default',
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: { md: 5, lg: 7 },
          gap: 4,
          minHeight: 0,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha('#fff', 0.18)} transparent`,
          color: '#fff',
          bgcolor: ink[950],
          backgroundImage: `radial-gradient(900px 500px at 0% 0%, ${alpha(brand.main, 0.28)}, transparent 60%), radial-gradient(700px 400px at 100% 100%, ${alpha(brand.dark, 0.22)}, transparent 60%)`,
        }}
      >
        <BrandMark inverse />
        <Stack spacing={4}>
          <Typography variant="h3" component="p" sx={{ maxWidth: 420, fontSize: { md: '2.1rem', lg: '2.5rem' }, lineHeight: 1.12 }}>
            Your seat, held just for you.
          </Typography>
          <Stack direction={{ md: 'column', lg: 'row' }} spacing={{ md: 3, lg: 5 }} alignItems={{ lg: 'center' }}>
            <SeatIllustration />
            <Stack spacing={2.25}>
              {[
                { step: '1', text: 'Find your perfect view', color: seatColors.selected.bg },
                { step: '2', text: 'Kept safe for a few minutes', color: seatColors.heldMine.bg },
                { step: '3', text: 'Lock it in', color: '#fff' },
              ].map((s) => (
                <Stack key={s.step} direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: s.color,
                      border: `1.5px solid ${alpha(s.color, 0.6)}`,
                      bgcolor: alpha(s.color, 0.12),
                    }}
                  >
                    {s.step}
                  </Box>
                  <Typography fontWeight={650} sx={{ color: alpha('#fff', 0.88) }}>
                    {s.text}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {['Live seat map', 'Timed holds', 'No double booking'].map((point) => (
            <Box key={point} sx={{ px: 1.25, py: 0.5, borderRadius: 999, fontSize: '0.75rem', fontWeight: 650, color: alpha('#fff', 0.78), border: `1px solid ${alpha('#fff', 0.16)}` }}>
              {point}
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Flex with an auto margin centres the form in the visible screen and still lets it scroll on short windows. */}
      <Box sx={{ display: 'flex', minHeight: 0, overflowY: 'auto', p: { xs: 3, sm: 6 } }}>
        <Stack component="form" spacing={3} onSubmit={handleSubmit} noValidate sx={{ width: '100%', maxWidth: 400, m: 'auto' }}>
          <Box sx={{ display: { md: 'none' } }}>
            <BrandMark />
          </Box>
          <Box>
            <Typography variant="h4" component="h1">
              Sign in
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Welcome back to Seatwise.
            </Typography>
          </Box>
          {error && !Object.keys(error.fieldErrors).length && <Alert severity="error">{error.message}</Alert>}
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={Boolean(fieldError('email'))}
            helperText={fieldError('email')}
            required
            autoFocus
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={Boolean(fieldError('password'))}
            helperText={fieldError('password')}
            required
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" loading={submitting} fullWidth>
            Sign in
          </Button>
          {DEMO_PASSWORD && (
            <DemoAccounts
              onUse={(demoEmail) => {
                setEmail(demoEmail);
                setPassword(DEMO_PASSWORD);
                setError(null);
              }}
            />
          )}
        </Stack>
      </Box>
    </Box>
  );
}
