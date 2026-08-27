'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: (event?: React.MouseEvent<HTMLElement>) => void;
};

const STORAGE_KEY = 'fq-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(next: Theme) {
  document.documentElement.setAttribute('data-theme', next);
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' || current === 'light' ? current : readStoredTheme());
  }, []);

  const toggleTheme = useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      const next: Theme = theme === 'dark' ? 'light' : 'dark';
      const x = event?.clientX ?? window.innerWidth / 2;
      const y = event?.clientY ?? 24;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const doc = document as Document & {
        startViewTransition?: (update: () => void) => { ready: Promise<void> };
      };

      const commit = () => {
        flushSync(() => {
          setTheme(next);
          applyTheme(next);
        });
      };

      if (reduced || !doc.startViewTransition) {
        commit();
        return;
      }

      const transition = doc.startViewTransition(commit);
      transition.ready.then(() => {
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 680,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        );
      });
    },
    [theme],
  );

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
