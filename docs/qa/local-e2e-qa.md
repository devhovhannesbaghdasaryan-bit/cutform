# Local E2E QA Evidence

Date: 2026-06-18

## Automated Checks

- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm smoke` passed.
- `SNIP_SMOKE_BASE_URL=http://localhost:3320 pnpm smoke:runtime` passed with 8 route checks and 45 sitemap URL checks.
- `pnpm smoke:db-workflows` passed against local Supabase with disposable QA records.
- `SNIP_SMOKE_BASE_URL=http://localhost:3320 pnpm smoke:ui-workflows` passed against a production-mode local app server after adding disposable confirmed customer/admin login coverage.
- `scripts/smoke/ui-workflows.mjs` was then expanded further for customized banner generation, generated-banner cart insertion, checkout review, and advanced banner credit spending. That expanded browser run has not been rerun yet because the command escalation reviewer returned a usage-limit rejection.
- `pnpm build` passed.
- `git diff --check` passed.

## Visual Checks

Production-mode screenshots were captured from `http://localhost:3320` after `pnpm build`.

- `docs/qa/screenshots/reference-home-desktop.png`
- `docs/qa/screenshots/reference-home-mobile.png`
- `docs/qa/screenshots/snip-home-desktop.png`
- `docs/qa/screenshots/snip-home-mobile.png`
- `docs/qa/screenshots/snip-catalog-desktop.png`
- `docs/qa/screenshots/snip-catalog-mobile.png`
- `docs/qa/screenshots/snip-item-desktop.png`
- `docs/qa/screenshots/snip-cart-desktop.png`
- `docs/qa/screenshots/snip-cart-mobile.png`
- `docs/qa/screenshots/snip-banners-desktop.png`
- `docs/qa/screenshots/snip-personalized-desktop.png`

Result:

- Landing, catalog, item detail, cart, banners, and personalized night light listing render in the same clean, high-contrast marketplace direction as the reference app.
- Desktop layouts render without obvious clipping or overlap.
- Mobile landing, catalog, and cart were recaptured through Chrome DevTools Protocol with an explicit `390x844` viewport.
- Mobile landing, catalog, and cart reported `scrollWidth === viewportWidth`, confirming no horizontal overflow in the measured viewport.

## Remaining Manual Coverage

The DB workflow smoke verifies:

- Disposable local user/profile creation and admin role assignment.
- Guest cart creation, item insertion, merge into user cart, and cart conversion.
- Credit account setup plus credit ledger entry.
- Provider-safe manual adjustment transaction and admin audit row creation.
- Personalized generated item data with selected preview, hidden SVG, original images, text, LED color, and generation metadata.
- Order and order item snapshot storage for catalog and personalized generated items.

The UI workflow smoke verifies:

- Landing page render and language switcher cookie behavior.
- Catalog page render and guest add-to-cart action.
- Guest cart item render before login.
- Password login with a disposable confirmed customer.
- Guest cart merge after login.
- Customer dashboard credit balance visibility.
- Authenticated cart quantity update, item removal, and empty-cart state.
- Banners page render and advanced AI banner entry point.
- Personalized night light listing render and authenticated model detail/form entry point.
- Password login with a disposable confirmed admin.
- Protected admin page rendering for dashboard, users, transactions, items, orders, generated items, banner samples, and personalized models.

The full manual click-through checklist is not complete. The in-app Browser runner fails locally with `CreateProcessAsUserW failed: 5`, so these flows still need a human browser pass with configured test accounts, Ameriabank test credentials, and OpenAI credentials:

- Register flow and email verification through the real browser session.
- Admin user, transaction, SEO, catalog, generated item, and order mutation workflows through the rendered admin UI.
- Ameriabank checkout and callback confirmation.
- OpenAI-backed generation flows for personalized night lights, banners, night lights, and 2D items.
- Final order placement checks for generated/personalized assets in admin order details.
