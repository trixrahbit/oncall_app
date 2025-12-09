import React from 'react';
import { FluentProvider, Theme, webDarkTheme, webLightTheme } from '@fluentui/react-components';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function resolveTheme(mode: ThemeMode): { theme: Theme; effectiveMode: 'light' | 'dark' } {
  let effective: 'light' | 'dark' = 'light';
  if (mode === 'system') {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    effective = prefersDark ? 'dark' : 'light';
  } else {
    effective = mode;
  }
  return { theme: effective === 'dark' ? webDarkTheme : webLightTheme, effectiveMode: effective };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<ThemeMode>(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('themeMode') as ThemeMode | null) : null;
    return saved || 'system';
  });

  const [theme, setTheme] = React.useState<Theme>(() => resolveTheme(mode).theme);

  React.useEffect(() => {
    const { theme: t } = resolveTheme(mode);
    setTheme(t);
    try { localStorage.setItem('themeMode', mode); } catch {}
  }, [mode]);

  React.useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => setTheme(resolveTheme('system').theme);
    mql.addEventListener?.('change', listener);
    return () => mql.removeEventListener?.('change', listener);
  }, [mode]);

  const value = React.useMemo<ThemeContextValue>(() => ({
    mode,
    setMode,
    toggle: () => setMode(prev => prev === 'dark' ? 'light' : 'dark'),
  }), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <FluentProvider theme={theme}>{children}</FluentProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeProvider');
  return ctx;
}
