/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {}
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('tempworks_theme') || 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState('light');

  const setTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
      setThemeState(newTheme);
      localStorage.setItem('tempworks_theme', newTheme);
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = () => {
      root.removeAttribute('data-theme');
      let nextTheme = 'light';

      if (theme === 'dark') {
        nextTheme = 'dark';
      } else if (theme === 'light') {
        nextTheme = 'light';
      } else {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        nextTheme = systemDark ? 'dark' : 'light';
      }

      setResolvedTheme(nextTheme);
      root.setAttribute('data-theme', nextTheme);
    };

    applyTheme();

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        applyTheme();
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
    return undefined;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
