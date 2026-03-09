export const themes = {
  terminal: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#39ff14',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
  ocean: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#38bdf8',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
  forest: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#4ade80',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
  ember: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#f97316',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
  violet: {
    void: '#0a0a0a',
    secondary: '#161616',
    surface: '#1e1e1e',
    accent: '#a78bfa',
    text: '#e0e0e0',
    textMuted: '#888888',
    border: '#2a2a2a',
  },
} as const;

export type ThemeName = keyof typeof themes;
export type ThemeColors = (typeof themes)[ThemeName];
export const defaultTheme: ThemeName = 'terminal';
