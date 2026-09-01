/**
 * ZerebroKid Design System — Single source of truth for all design tokens.
 *
 * Based on the locked token sheet from the master prompt pack.
 * Primary: violet #6D3BFF | 4px spacing base | 390×844 frame.
 *
 * RULES:
 * - Never introduce values not in this file.
 * - Only add a new token when the design explicitly requires a value
 *   not covered below.
 */

// ─────────────────────────────────────────────────────────────────────────────
// COLORS
// ─────────────────────────────────────────────────────────────────────────────

/** Brand violet palette */
export const brand = {
  /** violet-700 — pressed state, deep gradient stop */
  violet700: '#4E24E0',
  /** violet-600 — PRIMARY: buttons, active nav, accents */
  violet600: '#6D3BFF',
  /** violet-500 — hover, secondary fills, gradient start */
  violet500: '#7C4DFF',
  /** violet-400 — hover highlights */
  violet400: '#8B62FF',
  /** violet-100 — tinted bg, selected chips */
  violet100: '#EDE6FF',
  /** violet-50 — softest tint */
  violet50: '#F5F0FF',
} as const;

/** Semantic support colors */
export const semantic = {
  // Green — correct, success, savings
  green600: '#12B76A',
  green700: '#0B7B48',
  green100: '#DCF7EA',
  // Blue — information, video, links
  blue600: '#2F6BFF',
  blue700: '#1B4FD1',
  blue100: '#E4EDFF',
  // Red — wrong answer ONLY (never "you failed")
  red600: '#E5484D',
  red100: '#FDE7E7',
  // Orange — streak, urgency, timer
  orange600: '#FF7A1A',
  orange700: '#C25200',
  orange100: '#FFEDDF',
  // Gold — rewards, trophies
  gold500: '#FFB020',
  gold700: '#B87900',
  gold600: '#8A5A00',
  gold100: '#FFF3DC',
  // Teal — social science / geography
  teal600: '#0FA3A3',
  teal700: '#0A7A7A',
  teal100: '#DFF3F3',
  // Gold warm — reward highlight text
  goldWarm: '#FFE9B8',
} as const;

/** Junior Mode (Nursery - Class 5) theme tokens */
export const junior = {
  bgHome: '#602EDB',
  textDark: '#1B4FD1',
  textHeaderDark: '#1B1440',
  pinkHeaderStart: '#F0447F',
  pinkHeaderEnd: '#D6246A',
  pinkText: '#D6246A',
  yellowCoinBg: '#FFD84D',
  yellowCoinText: '#8A5A00',
  purplePillText: '#7B2FF7',
  cardFunBg: '#FFB800',
  cardCartoonsBg: '#E8407F',
  cardReelsBg: '#8A2BE2',
  cardGamesBg: '#1B1440',
  darkArcadeBg: '#110D29',
} as const;

/** Neutral scale */
export const neutral = {
  /** ink-900 — headlines */
  ink900: '#14142B',
  /** ink-700 — body text */
  ink700: '#33334D',
  /** ink-500 — secondary / muted text */
  ink500: '#6B6B85',
  /** ink-300 — disabled */
  ink300: '#A9A9C0',
  /** line-200 — borders, dividers */
  line200: '#E8E8F2',
  /** bg-app — app background (never pure white) */
  bgApp: '#F5F5FB',
  /** surface — white card surface */
  surface: '#FFFFFF',
  /** bg-dark — dark mode surface (video, quiz, focus) */
  bgDark: '#14142B',
  /** dark-surface-2 — elevated dark card */
  darkSurface2: '#33334D',
} as const;

/**
 * Flat color map — for backward-compatibility with existing code that
 * imports `{ colors }` from theme. New code should prefer the semantic
 * namespaces above.
 */
export const colors = {
  // Backgrounds
  bg: neutral.bgApp,
  surface: neutral.surface,
  surfaceAlt: neutral.bgApp,
  bgDark: neutral.bgDark,

  // Text
  text: neutral.ink900,
  textBody: neutral.ink700,
  textMuted: neutral.ink500,
  textDisabled: neutral.ink300,

  // Brand
  primary: brand.violet600,
  primaryDark: brand.violet700,
  primaryLight: brand.violet400,
  primaryTint: brand.violet100,
  primaryText: neutral.surface,

  // Semantic
  success: semantic.green600,
  successDark: semantic.green700,
  successTint: semantic.green100,
  danger: semantic.red600,
  dangerTint: semantic.red100,
  warning: semantic.orange600,
  warningTint: semantic.orange100,
  info: semantic.blue600,
  infoTint: semantic.blue100,
  gold: semantic.gold500,
  goldTint: semantic.gold100,

  // Border
  border: neutral.line200,

  // Legacy compat
  primaryPurple: brand.violet500,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// GRADIENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Gradient token definitions (start/end color pairs for LinearGradient). */
export const gradients = {
  /** grad-primary: primary CTA, splash, quiz gate */
  primary: { start: brand.violet500, end: brand.violet700 },
  /** grad-violet-subtle: cards, section headers */
  violetSubtle: { start: brand.violet100, end: '#E1D6FF' },
  /** grad-green: success surfaces */
  green: { start: semantic.green100, end: '#C6F0DC' },
  /** grad-blue: info surfaces */
  blue: { start: semantic.blue100, end: '#D3E2FF' },
  /** grad-orange: food/reward illustrations */
  orange: { start: semantic.orange100, end: '#FFE2C8' },
  /** grad-teal: geography/social science */
  teal: { start: semantic.teal100, end: '#CDEBEB' },
  /** grad-gold: reward highlights */
  gold: { start: semantic.gold100, end: '#FFE2A0' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Font families.
 * Fonts must be registered in android/app/src/main/assets/fonts/ and
 * `android/app/build.gradle` (or via `react-native.config.js`).
 */
export const fonts = {
  /** Plus Jakarta Sans — display / headings */
  heading: 'PlusJakartaSans-Bold',
  headingExtraBold: 'PlusJakartaSans-ExtraBold',
  /** Inter — body / UI copy */
  body: 'Inter-Regular',
  bodyMedium: 'Inter-Medium',
  bodySemiBold: 'Inter-SemiBold',
  /** Space Grotesk — monospaced numbers, code labels */
  mono: 'SpaceGrotesk-Bold',
} as const;

/** Type scale. All values in sp (RN uses dp == sp on Android). */
export const typography = {
  // Display
  display: { fontSize: 34, lineHeight: 40, letterSpacing: -0.7 },
  // Headings
  h1: { fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontSize: 20, lineHeight: 26, letterSpacing: -0.1 },
  h4: { fontSize: 18, lineHeight: 24 },
  h5: { fontSize: 17, lineHeight: 22 },
  // Body
  bodyLg: { fontSize: 15, lineHeight: 24 },
  body: { fontSize: 13, lineHeight: 18 },
  bodySm: { fontSize: 12, lineHeight: 16 },
  // Labels / overlines
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.5 },
  // Mono
  monoLg: { fontSize: 22, lineHeight: 26 },
  mono: { fontSize: 15, lineHeight: 20 },
  monoSm: { fontSize: 13, lineHeight: 18 },
  monoXs: { fontSize: 11, lineHeight: 14 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SPACING  (4px base)
// ─────────────────────────────────────────────────────────────────────────────

export const spacing = {
  /** 2px */
  xxs: 2,
  /** 4px */
  xs: 4,
  /** 8px */
  sm: 8,
  /** 12px */
  md12: 12,
  /** 16px */
  md: 16,
  /** 20px — default horizontal page padding */
  pagePad: 20,
  /** 24px */
  lg: 24,
  /** 28px */
  lg28: 28,
  /** 32px */
  xl: 32,
  /** 40px */
  xxl: 40,
  /** 56px — top inset clearance (status bar + nav) */
  topInset: 56,
  /** 72px — bottom nav height */
  bottomNav: 72,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// BORDER RADIUS
// ─────────────────────────────────────────────────────────────────────────────

export const radius = {
  /** 6px — small chips, tags */
  xs: 6,
  /** 8px — small inputs */
  sm: 8,
  /** 12px — inner cards */
  md: 12,
  /** 14px — icon chips */
  chip: 14,
  /** 16px — standard card inner elements */
  lg: 16,
  /** 20px — large inner cards */
  xl: 20,
  /** 24px — primary card surface */
  card: 24,
  /** 999px — pills, fully rounded */
  pill: 999,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ELEVATION / SHADOWS
// ─────────────────────────────────────────────────────────────────────────────

/** Shadow tokens (iOS-compatible; use `elevation` for Android). */
export const shadows = {
  /** Subtle card shadow */
  card: {
    shadowColor: neutral.ink900,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** Medium card shadow (featured cards) */
  cardMd: {
    shadowColor: neutral.ink900,
    shadowOpacity: 0.10,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  /** Large CTA / floating element shadow */
  cta: {
    shadowColor: brand.violet700,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  /** Purple brand shadow for violet surfaces */
  brand: {
    shadowColor: brand.violet600,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;
