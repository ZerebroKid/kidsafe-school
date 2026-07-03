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

/**
 * Screen background gradient (soft blue tint fading to white) plus the pastel pairs used for
 * app-icon fallback tiles. Gradients are rendered with react-native-svg — RN has no CSS
 * gradients — so these are plain hex stops, not style objects.
 */
export const gradients = {
  /** Top → bottom stops for the Child Details screen background. Values sampled from the
   * design mock: pale sky-blue up top, near-white center, pale mint at the bottom. */
  screen: {from: '#e7f4fc', mid: '#fafdfd', to: '#e4f8f3'},
  /** Pale tint for circular state-icon containers (moon / warning / phone glyphs). */
  iconCircle: '#e0f2fe',
  /** Palette for deterministic letter-tile fallbacks; loosely matches the mock's oklch tiles. */
  tiles: [
    {from: '#3b82f6', to: '#4f46e5'}, // blue → indigo
    {from: '#38bdf8', to: '#3b82f6'}, // sky → blue
    {from: '#a855f7', to: '#c026d3'}, // purple → fuchsia
    {from: '#fbbf24', to: '#f59e0b'}, // amber
    {from: '#34d399', to: '#06b6d4'}, // green → cyan
    {from: '#818cf8', to: '#8b5cf6'}, // indigo → violet
  ],
};

/**
 * Stable palette pick per key (package name, child uid, ...): hashing keeps a given item on
 * the same tile color across renders and devices. Used for letter-tile icon fallbacks.
 */
export function tileGradientFor(key: string) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return gradients.tiles[Math.abs(hash) % gradients.tiles.length];
}

/** Shared soft shadow for cards/chips sitting on the gradient background. */
export const softShadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: {width: 0, height: 2},
  elevation: 2,
};
