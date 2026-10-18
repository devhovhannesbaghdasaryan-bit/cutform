import { MarketplaceHeader } from '@/components/marketplace-header';

/**
 * Account pages used to render a second, simpler header. The storefront
 * header now serves every page; this wrapper keeps the old import and prop
 * working so call sites did not have to change.
 */
export async function SiteHeader(_props: { email?: string }) {
  return <MarketplaceHeader />;
}
