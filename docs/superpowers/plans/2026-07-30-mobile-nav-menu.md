# Mobile Navigation Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give sub-`sm` viewports a hamburger dropdown so every primary nav destination stays reachable on phones.

**Architecture:** One new client component (`MobileNavMenu`) composed from the existing Radix `dropdown-menu` primitive, fed entirely by props from the server-rendered `MarketplaceHeader`. Desktop rendering is untouched.

**Tech Stack:** Next.js App Router, next-intl, Radix dropdown-menu (already a dependency), lucide-react, Vitest/Biome/tsc toolchain via pnpm.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-mobile-nav-menu-design.md`
- No new dependencies.
- `MobileNavMenu` does no data fetching — all state and strings arrive as props.
- Hamburger renders only below `sm` (class `sm:hidden`); desktop (≥640px) output of the header must be byte-identical to today.
- New i18n key `nav.menu` in all three locale files (`messages/en.json`, `messages/am.json`, `messages/ru.json`).
- Work on branch `mobile-nav-menu`.
- If you run the formatter, scope it to files you changed; verify `git status --porcelain` shows no unrelated modified tracked files before committing.

---

### Task 1: MobileNavMenu component, i18n keys, header integration

**Files:**
- Create: `components/mobile-nav-menu.tsx`
- Modify: `components/marketplace-header.tsx` (right-hand cluster, after the auth ternary)
- Modify: `messages/en.json`, `messages/am.json`, `messages/ru.json` (add `nav.menu`)

**Interfaces:**
- Consumes: `Button` from `@/components/ui/button`; `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` from `@/components/ui/dropdown-menu`; lucide icons.
- Produces: `MobileNavMenu(props: { isAuthenticated: boolean; isAdmin: boolean; creditBalance: number; labels: MobileNavLabels })` — consumed only by `marketplace-header.tsx`.

- [ ] **Step 1: Add the i18n key**

In `messages/en.json`, inside the existing `"nav"` object, add:

```json
"menu": "Menu"
```

In `messages/am.json`, inside `"nav"`:

```json
"menu": "Մենյու"
```

In `messages/ru.json`, inside `"nav"`:

```json
"menu": "Меню"
```

(Match each file's existing property formatting; position after the existing `"home"` key is fine.)

- [ ] **Step 2: Create the component**

Create `components/mobile-nav-menu.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { Coins, LayoutDashboard, Menu, ShieldCheck, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface MobileNavLabels {
  menu: string;
  catalog: string;
  credits: string;
  dashboard: string;
  admin: string;
  profile: string;
  login: string;
  signup: string;
}

/**
 * Sub-`sm` replacement for the header's hidden text links. Renders nothing on
 * desktop (`sm:hidden`); receives all state and strings as props so the
 * server-rendered header stays the only data owner.
 */
export function MobileNavMenu({
  isAuthenticated,
  isAdmin,
  creditBalance,
  labels,
}: {
  isAuthenticated: boolean;
  isAdmin: boolean;
  creditBalance: number;
  labels: MobileNavLabels;
}) {
  return (
    <div className="sm:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={labels.menu}>
            <Menu className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuItem asChild>
            <Link href="/catalog" className="cursor-pointer">
              {labels.catalog}
            </Link>
          </DropdownMenuItem>
          {isAuthenticated ? (
            <>
              <DropdownMenuItem asChild>
                <Link href="/credits" className="cursor-pointer">
                  <Coins className="mr-2 h-4 w-4" />
                  {labels.credits} · {creditBalance}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard" className="cursor-pointer">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {labels.dashboard}
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {labels.admin}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <UserCircle className="mr-2 h-4 w-4" />
                  {labels.profile}
                </Link>
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem asChild>
                <Link href="/login" className="cursor-pointer">
                  {labels.login}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/register" className="cursor-pointer">
                  {labels.signup}
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the header**

In `components/marketplace-header.tsx`:

Add the import (with the other `@/components/*` imports):

```tsx
import { MobileNavMenu } from '@/components/mobile-nav-menu';
```

Then, inside the right-hand cluster `<div className="flex min-w-0 items-center gap-1 sm:gap-2">`, immediately after the closing of the `{user ? (…) : (…)}` ternary (after its `)}` line) and before the `</div>`, add:

```tsx
          <MobileNavMenu
            isAuthenticated={Boolean(user)}
            isAdmin={role === 'admin'}
            creditBalance={creditBalance}
            labels={{
              menu: t('nav.menu'),
              catalog: t('nav.catalog'),
              credits: t('nav.credits'),
              dashboard: t('nav.dashboard'),
              admin: t('nav.admin'),
              profile: t('nav.profile'),
              login: t('auth.login'),
              signup: t('auth.signup'),
            }}
          />
```

Nothing else in the header changes — every existing element and class stays exactly as it is.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck` (only acceptable error: the pre-existing one in `tests/lib/supabase/server.test.ts`, present on `main`), then `pnpm lint`, then `pnpm biome format --write components/mobile-nav-menu.tsx components/marketplace-header.tsx messages/en.json messages/am.json messages/ru.json`, then the full suite `pnpm test`.
Expected: lint clean, 279/279 tests pass (no test touches these files).

- [ ] **Step 5: Update the knowledge graph**

Run: `graphify update .`
Expected: completes without error. If graphify is unavailable, skip and note it in your report.

- [ ] **Step 6: Commit**

```bash
git add components/mobile-nav-menu.tsx components/marketplace-header.tsx messages/en.json messages/am.json messages/ru.json
git add -A graphify-out
git commit -m "feat: add mobile hamburger navigation menu

Below the sm breakpoint the header hid Catalog/Credits/Dashboard/Admin/
Sign up with no replacement, leaving phones without primary navigation.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Manual follow-ups (not engineer tasks)

- Browser QA at 375/414/768px per the spec's success criteria (signed out, signed in non-admin, signed in admin), including the 390px cart-icon clipping check the audit claimed.
- AM/RU label "Մենյու"/"Меню" — user proofread.
