import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cosmicThemeColors,
  dayThemeColors,
  type ParentThemeMode,
  type ThemeColors,
} from '../screens/parent/theme/parentTheme';

const THEME_STORAGE_KEY = '@zconnect_parent_theme';

interface ThemeState {
  themeMode: ParentThemeMode;
  setThemeMode: (mode: ParentThemeMode) => void;
  toggleTheme: () => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'cosmic', // default to Cosmic Night
  setThemeMode: mode => {
    set({themeMode: mode});
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {});
  },
  toggleTheme: () => {
    const next = get().themeMode === 'cosmic' ? 'day' : 'cosmic';
    get().setThemeMode(next);
  },
  loadTheme: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'cosmic' || saved === 'day') {
        set({themeMode: saved});
      }
    } catch {}
  },
}));

/**
 * Convenient React hook to get active parent theme colors and control actions.
 */
export function useParentTheme() {
  const themeMode = useThemeStore(s => s.themeMode);
  const setThemeMode = useThemeStore(s => s.setThemeMode);
  const toggleTheme = useThemeStore(s => s.toggleTheme);

  const colors = themeMode === 'cosmic' ? cosmicThemeColors : dayThemeColors;

  return {
    theme: colors,
    themeMode,
    isDark: themeMode === 'cosmic',
    setThemeMode,
    toggleTheme,
  };
}
