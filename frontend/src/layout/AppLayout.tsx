import { useState, type ReactNode } from 'react';
import { NavLink, Link as RouterLink, Outlet, useNavigate } from 'react-router-dom';
import { AppBar, Box, Button, Container, Drawer, IconButton, Stack, Toolbar, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import StadiumOutlinedIcon from '@mui/icons-material/StadiumOutlined';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useAuth } from '../auth/AuthContext';
import { BrandMark } from '../components/BrandMark';
import { UserAvatar } from '../components/UserAvatar';
import { brand, ink } from '../theme';

const SIDEBAR_WIDTH = 256;

function NavItem({ to, icon, label, onNavigate }: { to: string; icon: ReactNode; label: string; onNavigate(): void }) {
  return (
    <Button
      component={NavLink}
      to={to}
      onClick={onNavigate}
      startIcon={icon}
      fullWidth
      sx={{
        justifyContent: 'flex-start',
        minHeight: 42,
        px: 1.75,
        color: alpha('#fff', 0.68),
        position: 'relative',
        '& .MuiButton-startIcon': { mr: 1.5 },
        '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.06) },
        '&.active': {
          color: '#fff',
          bgcolor: alpha(brand.main, 0.16),
          '& .MuiButton-startIcon': { color: brand.light },
          '&::before': { content: '""', position: 'absolute', left: -12, top: 10, bottom: 10, width: 3, borderRadius: 3, bgcolor: brand.main },
        },
      }}
    >
      {label}
    </Button>
  );
}

function SidebarContent({ onNavigate }: { onNavigate(): void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <Stack sx={{ height: '100%', p: 1.5, pt: 2.5, color: '#fff' }}>
      <Box component={RouterLink} to="/" onClick={onNavigate} sx={{ textDecoration: 'none', px: 1.25, mb: 4 }}>
        <BrandMark inverse />
      </Box>

      <Typography variant="overline" sx={{ px: 1.75, mb: 1, color: alpha('#fff', 0.4), fontSize: '0.68rem' }}>
        Menu
      </Typography>
      <Stack component="nav" spacing={0.5}>
        <NavItem to="/events" icon={<StadiumOutlinedIcon fontSize="small" />} label="Events" onNavigate={onNavigate} />
        {user?.role === 'attendee' && (
          <NavItem to="/bookings" icon={<ConfirmationNumberOutlinedIcon fontSize="small" />} label="My tickets" onNavigate={onNavigate} />
        )}
        {user?.role === 'organizer' && <NavItem to="/settings" icon={<TuneRoundedIcon fontSize="small" />} label="Settings" onNavigate={onNavigate} />}
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      {user && (
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ p: 1.25, borderRadius: 2.5, bgcolor: alpha('#fff', 0.05), border: `1px solid ${alpha('#fff', 0.08)}` }}
        >
          <UserAvatar name={user.name} size={36} />
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {user.name}
            </Typography>
            <Typography variant="caption" sx={{ color: brand.light, fontWeight: 600 }}>
              {user.role === 'organizer' ? 'Organizer' : 'Attendee'}
            </Typography>
          </Box>
          <Tooltip title="Sign out">
            <IconButton aria-label="Sign out" onClick={handleSignOut} size="small" sx={{ color: alpha('#fff', 0.6), '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.08) } }}>
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      )}
    </Stack>
  );
}

const paperSx = {
  width: SIDEBAR_WIDTH,
  boxSizing: 'border-box',
  bgcolor: ink[950],
  borderRight: `1px solid ${alpha('#fff', 0.06)}`,
  backgroundImage: `radial-gradient(420px 260px at 0% 0%, ${alpha(brand.main, 0.18)}, transparent 70%)`,
} as const;

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, width: SIDEBAR_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': paperSx }}>
        <SidebarContent onNavigate={close} />
      </Drawer>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={close}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': paperSx }}
      >
        <SidebarContent onNavigate={close} />
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar position="sticky" sx={{ display: { md: 'none' }, bgcolor: ink[950] }}>
          <Toolbar sx={{ gap: 1, minHeight: 56 }}>
            <IconButton aria-label="Open menu" onClick={() => setMobileOpen(true)} edge="start" sx={{ color: '#fff' }}>
              <MenuRoundedIcon />
            </IconButton>
            <BrandMark inverse />
          </Toolbar>
        </AppBar>
        <Container component="main" maxWidth="xl" sx={{ mx: 0, py: { xs: 3, md: 5 }, px: { md: 5, lg: 6 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
