# Mobile navigation menu

**Date:** 2026-07-30
**Status:** Approved
**Origin:** July 2026 UX audit, critical finding: below the `sm` breakpoint the header hides Catalog, Credits, Dashboard, Admin, and Sign up (`hidden sm:inline*` in `components/marketplace-header.tsx`) with no replacement — mobile users cannot reach primary destinations.

## Design

### `components/mobile-nav-menu.tsx` (new, client component)

A hamburger button that opens the existing `DropdownMenu` primitive (`components/ui/dropdown-menu.tsx`). No new dependencies.

- Trigger: `Button` variant `ghost` size `icon` with lucide `Menu` icon, class `sm:hidden` so it renders only below the `sm` (640px) breakpoint, `aria-label` from the new `nav.menu` i18n key.
- Content: `DropdownMenuContent` (align end). Items, each a `DropdownMenuItem asChild` wrapping a `next/link` `Link` so navigation is native and the menu closes on select:
  - Catalog (`/catalog`) — always
  - Signed in: Credits with balance (`/credits`, label `{credits label} · {balance}`), Dashboard (`/dashboard`), Admin (`/admin`, only when `isAdmin`), Profile (`/profile`)
  - Signed out: Log in (`/login`), Sign up (`/register`)
- Props (no data fetching in the component): `isAuthenticated: boolean`, `isAdmin: boolean`, `creditBalance: number`, `labels: { menu, catalog, credits, dashboard, admin, profile, login, signup }` — all strings pre-translated by the server header.

### `components/marketplace-header.tsx` (modified)

- Desktop layout unchanged: existing text links keep their `hidden sm:*` classes.
- `<MobileNavMenu … />` appended to the right-hand cluster, after the profile/signup controls.
- The cart button remains outside the menu and always visible (it has no `hidden` class today; QA confirms it is not clipped at 390px — the audit claimed it vanishes, the code says it shouldn't).

### i18n

New key `nav.menu` ("Menu" / navigation-menu aria label) in `messages/en.json`, `messages/am.json`, `messages/ru.json`. All other labels reuse existing keys: `nav.catalog`, `nav.credits`, `nav.dashboard`, `nav.admin`, `nav.profile`, `auth.login`, `auth.signup`.

## Success criteria

At 375px, 414px, and 768px widths: every primary destination (Catalog, cart, Credits, Dashboard, Admin for admins, Profile / Login, Sign up) is reachable; the menu opens, navigates, and closes on select; `aria-label` present. Desktop (≥640px) rendering is unchanged.

## Testing

- Unit: none required — the component is declarative composition of already-tested primitives; no logic beyond conditional rendering.
- Manual browser QA at 375/414/768px, signed in (admin and non-admin) and signed out, plus the 390px cart-icon clipping check.

## Out of scope

- Catalog-link contrast, search, image placeholders (workstream D).
- Cart feedback/badge (workstream C, separate spec).
