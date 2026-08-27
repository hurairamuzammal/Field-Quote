'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      data-mode={theme}
      suppressHydrationWarning
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={theme === 'dark'}
      onClick={toggleTheme}
    >
      <span className="theme-toggle-rail">
        <span className="theme-toggle-thumb" aria-hidden="true" />
        <span className="theme-toggle-opt theme-toggle-opt--dark">
          <svg className="theme-toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M11.2 4.4A8.2 8.2 0 1 0 19.4 15.4 6.6 6.6 0 0 1 11.2 4.4Z"
              fill="currentColor"
              transform="translate(-1.2 0)"
            />
          </svg>
        </span>
        <span className="theme-toggle-opt theme-toggle-opt--light">
          <svg className="theme-toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path
              d="M12 4v1.8M12 18.2V20M4 12h1.8M18.2 12H20M6.4 6.4l1.3 1.3M16.3 16.3l1.3 1.3M6.4 17.6l1.3-1.3M16.3 7.7l1.3-1.3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
            />
          </svg>
        </span>
      </span>
    </button>
  );
}
