import { alpha, createTheme } from '@mui/material/styles';

/** Box-office palette: ink for structure and primary actions, teal as the brand accent. */
export const ink = { 950: '#0B1020', 900: '#111827', 800: '#1F2937', 700: '#374151' };
export const brand = { main: '#0D9488', light: '#5EEAD4', dark: '#0F766E', soft: '#CCFBF1' };
const slate = { 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 500: '#64748B', 600: '#475569' };

export const seatColors = {
  available: { bg: '#FFFFFF', border: slate[300], text: slate[600] },
  selected: { bg: brand.main, border: brand.dark, text: '#FFFFFF' },
  held: { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  heldMine: { bg: '#F59E0B', border: '#D97706', text: '#FFFFFF' },
  booked: { bg: slate[200], border: slate[200], text: '#94A3B8' },
  bookedMine: { bg: ink[900], border: ink[900], text: '#FFFFFF' },
};

export const theme = createTheme({
  palette: {
    primary: { main: ink[900], light: ink[700], dark: ink[950], contrastText: '#FFFFFF' },
    secondary: { main: brand.main, light: brand.light, dark: brand.dark, contrastText: '#FFFFFF' },
    success: { main: '#059669', light: '#D1FAE5' },
    warning: { main: '#D97706', light: '#FEF3C7' },
    error: { main: '#DC2626', light: '#FEE2E2' },
    info: { main: '#0284C7', light: '#E0F2FE' },
    background: { default: slate[50], paper: '#FFFFFF' },
    text: { primary: ink[900], secondary: slate[500] },
    divider: slate[200],
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    h3: { fontWeight: 800, letterSpacing: '-0.03em' },
    h4: { fontWeight: 800, letterSpacing: '-0.025em' },
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
    overline: { fontWeight: 700, letterSpacing: '0.12em', lineHeight: 1.6 },
    button: { textTransform: 'none', fontWeight: 650, letterSpacing: 0 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          minHeight: 40,
          paddingInline: 18,
          transition: 'background-color 120ms, box-shadow 120ms, border-color 120ms, transform 80ms',
          '&:active': { transform: 'translateY(1px)' },
          '&.Mui-focusVisible': { boxShadow: `0 0 0 3px ${alpha(brand.main, 0.35)}` },
        },
        sizeSmall: { minHeight: 32, paddingInline: 12, fontSize: '0.8125rem' },
        sizeLarge: { minHeight: 48, paddingInline: 24, fontSize: '0.975rem' },
        containedPrimary: {
          boxShadow: `0 1px 2px ${alpha(ink[950], 0.2)}, inset 0 1px 0 ${alpha('#FFFFFF', 0.08)}`,
          '&:hover': { backgroundColor: ink[800], boxShadow: `0 4px 12px ${alpha(ink[950], 0.18)}` },
        },
        containedSecondary: {
          boxShadow: `0 1px 2px ${alpha(brand.dark, 0.3)}`,
          '&:hover': { backgroundColor: brand.dark, boxShadow: `0 4px 12px ${alpha(brand.dark, 0.25)}` },
        },
        outlined: {
          borderColor: slate[300],
          backgroundColor: '#FFFFFF',
          '&:hover': { borderColor: slate[500], backgroundColor: slate[50] },
        },
        text: { '&:hover': { backgroundColor: alpha(ink[900], 0.05) } },
      },
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: slate[200], borderRadius: 14, boxShadow: `0 1px 2px ${alpha(ink[950], 0.04)}` } },
    },
    MuiPaper: { styleOverrides: { outlined: { borderColor: slate[200] } } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 650, borderRadius: 6 },
        sizeSmall: { height: 24, fontSize: '0.75rem' },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    MuiDialogTitle: { styleOverrides: { root: { fontWeight: 750, fontSize: '1.15rem', paddingTop: 22 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: '#FFFFFF',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: slate[500] },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: brand.main, borderWidth: 2 },
        },
        notchedOutline: { borderColor: slate[300] },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { '&.Mui-focused': { color: brand.dark } } } },
    MuiLinearProgress: {
      styleOverrides: { root: { height: 6, borderRadius: 6, backgroundColor: slate[100] }, bar: { borderRadius: 6 } },
    },
    MuiTooltip: {
      defaultProps: { arrow: true },
      styleOverrides: { tooltip: { backgroundColor: ink[900], fontWeight: 600, fontSize: '0.75rem' }, arrow: { color: ink[900] } },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 10, alignItems: 'center' } } },
  },
});

/** Soft tinted background for icon badges, e.g. tint('#0D9488'). */
export const tint = (color: string) => alpha(color, 0.12);
