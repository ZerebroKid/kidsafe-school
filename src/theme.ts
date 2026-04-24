/**
 * Single source of truth for colors, spacing and typography. Kept tiny on purpose — we can grow
 * this into a proper design system after launch.
 */
export const colors = {
  bg: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  primary: '#38BDF8',
  primaryText: '#0F172A',
  danger: '#F87171',
  success: '#4ADE80',
  warning: '#FACC15',
  border: '#334155',
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
