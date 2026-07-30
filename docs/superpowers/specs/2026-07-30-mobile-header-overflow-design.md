# Mobile header overflow fix

**Date:** 2026-07-30
**Status:** Approved
**Origin:** Post-deploy QA of the mobile nav (PR #36) measured the header's right cluster at ~412px wide (currency 76 + language 66 + theme 50 + cart 64 + profile 20 + hamburger 50 + gaps + logo offset 61), which overflows sub-412px viewports: the hamburger is clipped 25px at 390 and 39px at 375. Signed-out is also affected (~397px with the Log in button). This is the same overflow the July audit reported as "the cart icon vanishes at 390px".

## Design

Below the `sm` breakpoint, the header keeps only commerce-critical controls (currency, language, cart) plus the hamburger; Profile, Log in, and the theme toggle move behind the menu, shrinking the cluster to ~332px — fits 360/375/390/414 in both auth states. Desktop (≥`sm`) output is unchanged.

### `components/marketplace-header.tsx`

- Profile icon button (signed-in): add `className="hidden sm:inline-flex"`.
- Log in button (signed-out): add `className="hidden sm:inline-flex"` (destination exists in the mobile menu; keeping it visible would leave signed-out at ~397px, still clipped at 390/375).
- `<ThemeToggle />` becomes `<ThemeToggle className="hidden sm:inline-flex" />`.
- Nothing else changes.

### `components/theme-toggle.tsx`

- Export the existing `toggleTheme` logic as a named export `export function toggleTheme()` (moved out of the component body; behavior identical).
- `ThemeToggle` accepts optional `className?: string`, merged into the Button's existing classes with `cn()` from `@/lib/utils`.

### `components/mobile-nav-menu.tsx`

- After the existing nav items (both auth states), add `DropdownMenuSeparator` (already exported by `components/ui/dropdown-menu.tsx`) followed by a theme `DropdownMenuItem`:
  - Icons: the same Sun/Moon pair and dark-mode transition classes as `ThemeToggle`, sized `mr-2 h-4 w-4`.
  - Label: new `labels.theme` prop.
  - `onSelect={(event) => { event.preventDefault(); toggleTheme(); }}` — `preventDefault` keeps the menu open so the flip is immediately visible.
- `MobileNavLabels` gains `theme: string`.

### i18n

New key `nav.theme` in all three locale files: en `"Theme"`, am `"Թեմա"`, ru `"Тема"`. No existing key or value changes.

## Success criteria

At 375, 390, and 414px viewports, signed-in and signed-out: `document.documentElement.scrollWidth <= viewport width` (no horizontal overflow), the hamburger's bounding box lies fully inside the viewport, and the menu contains a working theme toggle (html.dark class flips, persists via the existing `snip-theme` localStorage key). At ≥640px (default font size) the header renders exactly as before this change.

## Testing

- Full Vitest suite stays green (no unit tests added — declarative UI, consistent with the mobile-nav spec).
- Post-deploy verification with the same-origin iframe viewport method used in QA: measure `scrollWidth` and hamburger rect at 375/390/414; exercise the menu theme item.

## Out of scope

- Moving currency/language switchers into the menu (approach C — rejected: select-in-menu complexity, and A already fits all target widths).
- The 320px viewport class (~332px cluster may still overflow by ~15px there; no current evidence of 320px traffic).
- AM/RU proofread of the new string (flagged with the other pending proofreads).
