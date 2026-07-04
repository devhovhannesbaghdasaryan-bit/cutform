# Cyberpunk-Inspired Theming Tasks

Date: 2026-07-02

Goal: give Snip accessible light and dark themes inspired by Cyberpunk 2077 while preserving the marketplace's product-first layout and behavior.

## Foundation

- [x] Define semantic light and dark color tokens for backgrounds, surfaces, text, borders, inputs, focus, actions, warnings, success, and destructive states.
- [x] Add restrained brand accents for electric yellow, cyan, and magenta.
- [x] Set native control color schemes and theme-aware selection styling.
- [x] Respect reduced-motion preferences during theme transitions.

## Theme Behavior

- [x] Use the saved theme when one exists.
- [x] Use the operating-system preference on a user's first visit.
- [x] Apply the initial theme before paint to avoid a light/dark flash.
- [x] Add an accessible theme toggle to the shared marketplace header.
- [x] Persist manual theme changes in local storage.

## Component Coverage

- [x] Theme shared buttons, cards, inputs, popovers, borders, and focus rings through semantic tokens.
- [x] Replace light-only landing, catalog, product, and generated-item surfaces.
- [x] Add theme-aware warning and success treatments for user and admin states.
- [x] Preserve product-preview colors where they represent physical materials or lighting.

## Verification

- [x] Run TypeScript, lint, production-build, and whitespace checks.
- [ ] Verify the generated-item page in light and dark themes.
- [ ] Confirm toggle persistence after reload.
- [ ] Check the browser console for new errors.

Browser checks remain open because the in-app browser security policy blocked access to the already-open local page during verification.
