# Redesign launch readiness

Run `pnpm smoke:redesign` before launch. The static smoke check verifies:

- Public storefront pages use `MarketplaceHeader`.
- Landing, catalog, banner, and generated detail pages share the storefront layout rhythm.
- Catalog grids use stable responsive product-card tracks.
- Banner generation entry points remain visually connected to the storefront.
- Shared storefront utilities exist in `app/globals.css`.

Manual visual review before launch:

- Replace any placeholder product art with approved catalog or generated assets.
- Check desktop and mobile spacing on `/`, `/catalog`, `/banners`, `/generated/[id]`, and item detail pages.
- Confirm product cards keep stable image ratios and text does not overflow.
- Confirm generation entry points feel like marketplace workflows, not disconnected tools.
- Confirm colors do not collapse into a single-hue theme.
