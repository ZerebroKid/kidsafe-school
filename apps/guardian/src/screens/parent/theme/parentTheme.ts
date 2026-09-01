/**
 * Dual Theme System for the Parent App (Cosmic Night Dark & Warm Day Light).
 * Derived from information-architecture-analysis prototypes.
 */

export type ParentThemeMode = 'cosmic' | 'day';

export interface ThemeColors {
  mode: ParentThemeMode;
  bg: string;
  surface: string;
  surfaceAlt: string;
  cardBg: string;
  cardBgSubtle: string;
  cardBorder: string;
  cardBorderSubtle: string;
  text: string;
  textMuted: string;
  textSubtle: string;

  primary: string;
  primaryBg: string;
  primaryBorder: string;
  primaryText: string;

  liveCyan: string;
  liveCyanBg: string;
  liveCyanBorder: string;

  successGreen: string;
  successGreenBg: string;
  successGreenBorder: string;

  danger: string;
  dangerBg: string;
  dangerBorder: string;

  warning: string;
  warningBg: string;
  warningBorder: string;

  purpleAccent: string;
  purpleAccentBg: string;
  purpleAccentBorder: string;

  trackBg: string;
  navBg: string;
  navBorder: string;
  statusBar: 'light-content' | 'dark-content';
}

export const cosmicThemeColors: ThemeColors = {
  mode: 'cosmic',
  bg: '#05071C',
  surface: '#070B2B',
  surfaceAlt: '#0C1035',
  cardBg: 'rgba(23, 19, 79, 0.88)',
  cardBgSubtle: 'rgba(12, 16, 53, 0.94)',
  cardBorder: 'rgba(139, 132, 200, 0.24)',
  cardBorderSubtle: 'rgba(139, 132, 200, 0.16)',

  text: '#FFFFFF',
  textMuted: '#B9B9D5',
  textSubtle: '#8B84C8',

  primary: '#6D3FE7',
  primaryBg: 'rgba(109, 63, 231, 0.18)',
  primaryBorder: 'rgba(168, 85, 247, 0.35)',
  primaryText: '#FFFFFF',

  liveCyan: '#35D9FF',
  liveCyanBg: 'rgba(53, 217, 255, 0.12)',
  liveCyanBorder: 'rgba(53, 217, 255, 0.28)',

  successGreen: '#55D98B',
  successGreenBg: 'rgba(85, 217, 139, 0.13)',
  successGreenBorder: 'rgba(85, 217, 139, 0.3)',

  danger: '#E95CFF',
  dangerBg: 'rgba(233, 92, 255, 0.14)',
  dangerBorder: 'rgba(233, 92, 255, 0.3)',

  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.14)',
  warningBorder: 'rgba(245, 158, 11, 0.3)',

  purpleAccent: '#C084FC',
  purpleAccentBg: 'rgba(192, 132, 252, 0.16)',
  purpleAccentBorder: 'rgba(192, 132, 252, 0.3)',

  trackBg: 'rgba(139, 132, 200, 0.16)',
  navBg: 'rgba(7, 11, 43, 0.96)',
  navBorder: 'rgba(139, 132, 200, 0.22)',
  statusBar: 'light-content',
};

export const dayThemeColors: ThemeColors = {
  mode: 'day',
  bg: '#F2EDEA',
  surface: '#FFF7F9',
  surfaceAlt: '#FFFFFF',
  cardBg: '#FFFFFF',
  cardBgSubtle: '#FFF7F9',
  cardBorder: '#F6E2E7',
  cardBorderSubtle: '#EADFDA',

  text: '#1F1B1C',
  textMuted: '#6B5C59',
  textSubtle: '#8B7B78',

  primary: '#E11D53',
  primaryBg: '#FFF1F4',
  primaryBorder: '#F6E2E7',
  primaryText: '#FFFFFF',

  liveCyan: '#0284C7',
  liveCyanBg: 'rgba(2, 132, 199, 0.1)',
  liveCyanBorder: 'rgba(2, 132, 199, 0.25)',

  successGreen: '#15803D',
  successGreenBg: 'rgba(34, 197, 94, 0.12)',
  successGreenBorder: 'rgba(34, 197, 94, 0.25)',

  danger: '#E11D53',
  dangerBg: 'rgba(225, 29, 83, 0.08)',
  dangerBorder: 'rgba(225, 29, 83, 0.2)',

  warning: '#B45309',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  warningBorder: 'rgba(245, 158, 11, 0.25)',

  purpleAccent: '#6F5E8C',
  purpleAccentBg: '#EFE7F8',
  purpleAccentBorder: '#E6DBF2',

  trackBg: '#EADFDA',
  navBg: '#FFFFFF',
  navBorder: '#EADFDA',
  statusBar: 'dark-content',
};

export const parentRadius = {
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};

export const parentSpacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 24,
};
