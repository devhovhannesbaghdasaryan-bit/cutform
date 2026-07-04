'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const THEME_KEY = 'snip-theme';

type Theme = 'light' | 'dark';

function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeToggle() {
  function toggleTheme() {
    const nextTheme: Theme = getTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="relative shrink-0 text-cyber-cyan hover:bg-secondary hover:text-secondary-foreground"
    >
      <Sun className="h-4 w-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" aria-hidden="true" />
      <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" aria-hidden="true" />
    </Button>
  );
}
