/**
 * ThemeContext — ZerebroKid visual theme engine.
 *
 * Provides the active ThemeDefinition to all screens.
 * Selected themeId is persisted via MMKV across restarts.
 *
 * Usage:
 *   const { theme, themeId, setThemeId } = useTheme();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {MMKV} from 'react-native-mmkv';

import {
  DEFAULT_THEME_ID,
  THEMES,
  type ThemeDefinition,
  type ThemeId,
} from '../theme/themes';

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

const themeStorage = new MMKV({id: 'zkid.theme'});
const THEME_KEY = 'themeId';

function readPersistedThemeId(): ThemeId {
  const stored = themeStorage.getString(THEME_KEY);
  if (stored && stored in THEMES) {
    return stored as ThemeId;
  }
  return DEFAULT_THEME_ID;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: ThemeDefinition;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[DEFAULT_THEME_ID],
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [themeId, setThemeIdState] = useState<ThemeId>(readPersistedThemeId);

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    themeStorage.set(THEME_KEY, id);
  }, []);

  const theme = useMemo(() => THEMES[themeId] ?? THEMES[DEFAULT_THEME_ID], [themeId]);

  const value = useMemo<ThemeContextValue>(
    () => ({theme, themeId, setThemeId}),
    [theme, themeId, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
