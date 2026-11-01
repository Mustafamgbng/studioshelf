'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';
const STORAGE_KEY = 'studioshelf-theme';
const CHANGE_EVENT = 'studioshelf-theme-change';

function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function updateDocument(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#08090b' : '#fafafa');
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    updateDocument(event.newValue === 'light' ? 'light' : 'dark');
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export default function ThemeToggle({ className = '' }: { className?: string }) {
  // The server and first hydration snapshot are stable; the head script applies
  // the saved colours before paint, then this store reflects them after hydration.
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
  useEffect(() => updateDocument(getTheme()), []);
  const action = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  function toggle() {
    const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
    updateDocument(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The switch still works for this page when browser storage is disabled.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggle}
      aria-label={action}
      title={action}
    >
      {theme === 'dark' ? (
        <Sun size={17} strokeWidth={1.7} />
      ) : (
        <Moon size={17} strokeWidth={1.7} />
      )}
    </button>
  );
}
