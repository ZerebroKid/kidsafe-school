/**
 * Single source of truth for colors, spacing and typography. Kept tiny on purpose — we can grow
 * this into a proper design system after launch.
 */
export const colors = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f5f5f5',
  text: '#0a0a0a',
  textMuted: '#737373',
  primary: '#171717',
  primaryText: '#ffffff',
  danger: '#e7000b',
  success: '#4ade80',
  warning: '#facc15',
  border: '#e5e5e5',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};
