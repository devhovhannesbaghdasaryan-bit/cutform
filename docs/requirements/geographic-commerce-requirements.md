# Geographic Commerce Requirements

## Decisions

- Countries use ISO alpha-2 codes and belong to one editable active market region.
- Initial regions are Africa, Americas, Asia, Europe, and Oceania.
- Country selection priority is checkout address, saved cookie/profile preference, trusted geo header, then unknown.
- Catalog items are globally visible by default. Country overrides win over region rules.
- Geographic currencies are defaults only; an explicit user currency remains authoritative.
- Shipping is configured per catalog item and per unit in AMD. Country rates override region rates, zero is free, and blank is unavailable.
- Geography is a commerce-availability control, not a legal/content access-control boundary.

## Storefront and Checkout

- Unknown-country visitors may browse the global catalog but must select a country before checkout.
- Known-country catalog, popular-item, item-detail, add-to-cart, cart, and checkout flows enforce availability.
- Checkout collects recipient name, phone, address lines, city, optional state/province, optional postal code, and country.
- The server recomputes merchandise subtotal, converted shipping, and total from stored rules before order/payment creation.
- Orders snapshot address, country, per-line shipping, matched rule IDs/sources, conversion context, shipping total, and grand total.
- Generated items and banner samples retain their current shipping behavior in this catalog-first release. Taxes remain out of scope.

## Administration and Security

- Catalog admins manage regions, country membership, currency defaults, item visibility, and item shipping rates.
- Disabled assigned currencies display warnings and fall back to the next enabled default without destroying configuration.
- New public-schema tables have RLS enabled. Public roles read active commerce configuration; authenticated admins perform writes.
- All client-supplied destination and total values are validated or recomputed server-side.

## Acceptance

- Country visibility and shipping independently override region values.
- Explicit currency selection beats geographic defaults.
- Missing shipping blocks catalog checkout; zero shipping remains valid.
- Quantity multiplies per-unit shipping and payment transactions use the order grand total.
- Historical order totals and rule snapshots do not change after configuration updates.
