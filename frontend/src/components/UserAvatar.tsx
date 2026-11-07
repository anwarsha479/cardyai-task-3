import { Avatar } from '@mui/material';

const PALETTE = ['#0D9488', '#0284C7', '#7C3AED', '#D97706', '#DB2777', '#059669'];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Initials avatar with a colour that stays the same for the same name. */
export function UserAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <Avatar sx={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 700, bgcolor: PALETTE[hash % PALETTE.length] }}>
      {initials(name)}
    </Avatar>
  );
}
