import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeType = 'dark' | 'light';

interface ThemeContextValue {
  theme: ThemeType;
  setTheme: (t: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const stored = localStorage.getItem('theme-preference');
    return stored === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  function setTheme(t: ThemeType) {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme-preference', t);

    /*
     * Future settings page integration:
     * After the user saves preferences via the Settings page, call setTheme()
     * once the backend PATCH /user/preferences request resolves successfully.
     * Example:
     *   await api.patch('/user/preferences', { theme: t });
     *   setTheme(t);
     * This keeps localStorage and the UI in sync with the persisted server value.
     */
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
