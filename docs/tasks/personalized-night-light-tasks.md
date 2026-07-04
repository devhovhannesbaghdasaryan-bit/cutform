# Personalized night-light implementation tasks

- [x] Add a normalized boilerplate table, RLS policies, ordering, localized
  names, hidden-SVG flag, and initial data migration.
- [x] Replace admin's single boilerplate field with boilerplate create, update,
  image replacement, activation, ordering, and removal controls.
- [x] Load active boilerplates on the personalized model page and implement an
  accessible multi-select visual form with live credit total.
- [x] Validate selected boilerplates server-side, debit one credit per selected
  option, generate only selected previews, and conditionally create hidden SVGs.
- [x] Update generated-result persistence and UI so multiple generated options
  can be selected and added to cart as separate configured lines.
- [x] Add English, Armenian, and Russian translations for form, loading, errors,
  balance dialog, results, and admin-facing guidance where applicable.
- [x] Add smoke coverage for template selection, credit calculation, hidden-SVG
  behavior, insufficient balance, and multi-add-to-cart.
- [ ] Run typecheck, lint, build, database/security checks, and browser QA for
  desktop and mobile states.
