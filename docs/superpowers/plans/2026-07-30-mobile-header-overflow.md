# Mobile Header Overflow Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the header's right cluster (~412px) from clipping the hamburger below 412px viewports by moving Profile, Log in, and the theme toggle behind the mobile menu.

**Architecture:** Pure CSS visibility changes in the header (`hidden sm:inline-flex` on three controls) plus one new menu item. `toggleTheme` is extracted as a named export from `theme-toggle.tsx` so the menu item and the desktop button share one implementation.

**Tech Stack:** Next.js App Router, Tailwind (`sm` = 40rem), Radix dropdown-menu, lucide-react, next-intl, pnpm toolchain (Vitest/Biome/tsc).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-mobile-header-overflow-design.md`
- No new dependencies. Desktop (≥`sm`) rendering must be byte-identical to today.
- Below `sm`, the header keeps: logo, currency, language, cart, hamburger. Profile, Log in, and ThemeToggle are `hidden sm:inline-flex`.
- New i18n key `nav.theme`: en `"Theme"`, am `"Թեմա"`, ru `"Тема"` — in all three locale files, NO existing key or value may change.
- Theme menu item: `onSelect` calls `event.preventDefault()` then `toggleTheme()` (menu stays open).
- Work on branch `mobile-header-overflow`.
- Formatter scoped to changed files; `git status --porcelain` must show no unrelated modified tracked files before committing. Commit only root graphify artifacts, never `graphify-out/20*/` dirs.

---

### Task 1: Hide controls below `sm`, add theme item to the menu

**Files:**
- Modify: `components/theme-toggle.tsx` (extract `toggleTheme`, add `className` prop)
- Modify: `components/marketplace-header.tsx` (three class changes)
- Modify: `components/mobile-nav-menu.tsx` (theme menu item + label)
- Modify: `messages/en.json`, `messages/am.json`, `messages/ru.json` (add `nav.theme`)

**Interfaces:**
- Consumes: existing `cn` from `@/lib/utils`, `DropdownMenuSeparator` from `@/components/ui/dropdown-menu` (already exported).
- Produces: `export function toggleTheme(): void` from `@/components/theme-toggle`; `ThemeToggle({ className }: { className?: string })`; `MobileNavLabels` gains `theme: string`.

- [ ] **Step 1: Add the i18n keys**

Inside the `"nav"` object (after the existing `"menu"` key added by PR #36):

`messages/en.json`: `"theme": "Theme"`
`messages/am.json`: `"theme": "Թեմա"`
`messages/ru.json`: `"theme": "Тема"`

Change nothing else in these files. Verify with `git diff -- messages/` that only these three additions appear.

- [ ] **Step 2: Extract `toggleTheme` and add `className` to ThemeToggle**

Replace the full contents of `components/theme-toggle.tsx` with:

```tsx
'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const THEME_KEY = 'snip-theme';

type Theme = 'light' | 'dark';

function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function toggleTheme() {
  const nextTheme: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  document.documentElement.dataset.theme = nextTheme;
  window.localStorage.setItem(THEME_KEY, nextTheme);
}

export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className={cn(
        'relative shrink-0 text-cyber-cyan hover:bg-secondary hover:text-secondary-foreground',
        className,
      )}
    >
      <Sun
        className="h-4 w-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90"
        aria-hidden="true"
      />
      <Moon
        className="absolute h-4 w-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
        aria-hidden="true"
      />
    </Button>
  );
}
```

(The only changes from the current file: `toggleTheme` moved from inside the component to a named export, the `cn` import, and the `className` prop merged into the Button's classes. The class string itself is unchanged.)

- [ ] **Step 3: Header visibility changes**

In `components/marketplace-header.tsx`, exactly three edits:

1. `<ThemeToggle />` → `<ThemeToggle className="hidden sm:inline-flex" />`
2. The signed-in Profile button

```tsx
              <Button asChild variant="ghost" size="icon">
                <Link href="/profile" aria-label={t('nav.profile')}>
```

becomes

```tsx
              <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
                <Link href="/profile" aria-label={t('nav.profile')}>
```

3. The signed-out Log in button

```tsx
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">{t('auth.login')}</Link>
              </Button>
```

becomes

```tsx
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t('auth.login')}</Link>
              </Button>
```

Careful: the signed-out block has TWO ghost/sm buttons — the cart button (`href="/cart"`) keeps no `hidden` class; only the `/login` one changes. Also pass the new label where the header renders the menu: in the `<MobileNavMenu … labels={{ … }} />` block, add `theme: t('nav.theme'),` after `menu: t('nav.menu'),`.

- [ ] **Step 4: Theme item in the mobile menu**

In `components/mobile-nav-menu.tsx`:

1. Imports: add `Moon`, `Sun` to the lucide import (alphabetical: `Coins, LayoutDashboard, LayoutGrid, Menu, Moon, ShieldCheck, Sun, UserCircle`); add `DropdownMenuSeparator` to the dropdown-menu import; add `import { toggleTheme } from '@/components/theme-toggle';`.
2. `MobileNavLabels`: add `theme: string;` after `menu: string;`.
3. Inside `DropdownMenuContent`, immediately after the closing `)}` of the `isAuthenticated` ternary and before `</DropdownMenuContent>`, add:

```tsx
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(event) => {
              event.preventDefault();
              toggleTheme();
            }}
          >
            <Sun className="mr-2 h-4 w-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
            <Moon className="absolute mr-2 h-4 w-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
            {labels.theme}
          </DropdownMenuItem>
```

(`preventDefault` keeps the menu open so the theme flip is immediately visible. The Sun/Moon dark-mode transition classes mirror `ThemeToggle`; the `absolute` on Moon overlays the icons exactly as in the toggle button.)

- [ ] **Step 5: Verify**

Run: `pnpm typecheck` (only acceptable error: pre-existing one in `tests/lib/supabase/server.test.ts`, present on `main`), `pnpm lint`, `pnpm biome format --write components/theme-toggle.tsx components/marketplace-header.tsx components/mobile-nav-menu.tsx messages/en.json messages/am.json messages/ru.json`, then full `pnpm test`.
Expected: suite green (289 tests on current `main`); `git status --porcelain` shows no unrelated modified tracked files.

- [ ] **Step 6: Update the knowledge graph and commit**

Run: `graphify update .` (skip with a report note if unavailable).

```bash
git add components/theme-toggle.tsx components/marketplace-header.tsx components/mobile-nav-menu.tsx messages/en.json messages/am.json messages/ru.json
git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/manifest.json graphify-out/graph.html graphify-out/.graphify_labels.json
git commit -m "fix: keep mobile header inside sub-412px viewports

The right cluster (currency+language+theme+cart+profile+hamburger) was
~412px wide, clipping the hamburger 25px at 390 and 39px at 375. Profile,
Log in, and the theme toggle now hide below sm — all three remain
reachable via the mobile menu, which gains a theme toggle item.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Manual follow-ups (not engineer tasks)

- Post-deploy iframe-viewport verification at 375/390/414 (signed in + out): no horizontal overflow, hamburger fully visible, menu theme item flips `html.dark` and persists via `snip-theme`.
- AM/RU proofread of `nav.theme` with the other pending strings.
