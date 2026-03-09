// ThemeProvider — wraps app in theme context with AsyncStorage persistence.
// Re-exports contexts from _layout.tsx so components can import from either location.

import React, { useState, useEffect, useCallback, createContext } from 'react';
import { themes, defaultTheme, ThemeColors, ThemeName } from './colors';
import { appStorage } from '../adapters/storage';

export const ThemeContext = createContext<ThemeColors>(themes[defaultTheme]);
export const SetThemeContext = createContext<(name: ThemeName) => void>(() => {});
export const ThemeNameContext = createContext<ThemeName>(defaultTheme);

interface Props {
  userId: string | undefined;
  children: React.ReactNode;
}

export function ThemeProvider({ userId, children }: Props) {
  const [themeName, setThemeName] = useState<ThemeName>(defaultTheme);
  const themeColors = themes[themeName];

  // Load saved theme preference when userId is available
  useEffect(() => {
    if (!userId) return;
    appStorage.getJson<{ theme: ThemeName }>(`theme:${userId}`).then((pref) => {
      if (pref?.theme && themes[pref.theme]) {
        setThemeName(pref.theme);
      }
    });
  }, [userId]);

  const handleSetTheme = useCallback(
    (name: ThemeName) => {
      if (!themes[name]) return;
      setThemeName(name);
      if (userId) {
        appStorage.setJson(`theme:${userId}`, { theme: name });
      }
    },
    [userId]
  );

  return (
    <ThemeNameContext.Provider value={themeName}>
      <ThemeContext.Provider value={themeColors}>
        <SetThemeContext.Provider value={handleSetTheme}>
          {children}
        </SetThemeContext.Provider>
      </ThemeContext.Provider>
    </ThemeNameContext.Provider>
  );
}
