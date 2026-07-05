import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { MarketCountryFormValue, MarketRegionFormValue, MarketRuleFormValue } from './types';

export function MarketRulesSection({
  marketRegions,
  marketCountries,
  marketRules,
}: {
  marketRegions: MarketRegionFormValue[];
  marketCountries: MarketCountryFormValue[];
  marketRules: MarketRuleFormValue[];
}) {
  const regionRuleById = new Map(marketRules.filter((rule) => rule.region_id).map((rule) => [rule.region_id!, rule]));
  const countryRuleByCode = new Map(marketRules.filter((rule) => rule.country_code).map((rule) => [rule.country_code!, rule]));

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Markets &amp; shipping</h2>
        <p className="text-sm text-muted-foreground">
          Items are globally visible by default. Country settings override their region. Shipping is per unit in AMD; blank means unavailable and 0 means free.
        </p>
      </div>
      <div className="space-y-3">
        {marketRegions.filter((region) => region.is_active).map((region) => {
          const regionRule = regionRuleById.get(region.id);
          const countries = marketCountries.filter((country) => country.is_active && country.region_id === region.id);
          return (
            <details key={region.id} className="rounded-md border bg-muted/10">
              <summary className="cursor-pointer px-4 py-3 font-medium">{region.name} <span className="text-sm font-normal text-muted-foreground">({countries.length} countries)</span></summary>
              <div className="space-y-4 border-t p-4">
                <MarketRuleFields
                  prefix={`market_region_${region.id}`}
                  label={`${region.name} default`}
                  rule={regionRule}
                />
                <div className="divide-y rounded-md border bg-background">
                  {countries.map((country) => (
                    <MarketRuleFields
                      key={country.code}
                      prefix={`market_country_${country.code}`}
                      label={`${country.label} (${country.code})`}
                      rule={countryRuleByCode.get(country.code)}
                      compact
                    />
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function MarketRuleFields({
  prefix,
  label,
  rule,
  compact = false,
}: {
  prefix: string;
  label: string;
  rule?: MarketRuleFormValue;
  compact?: boolean;
}) {
  const visibility = rule?.visibility_override === true ? 'show' : rule?.visibility_override === false ? 'hide' : '';
  return (
    <div className={`grid gap-3 ${compact ? 'p-3 md:grid-cols-[minmax(200px,1fr)_180px_180px]' : 'md:grid-cols-[minmax(200px,1fr)_180px_180px]'} md:items-end`}>
      <div className="text-sm font-medium">{label}</div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}_visibility`} className="text-xs">Visibility</Label>
        <select id={`${prefix}_visibility`} name={`${prefix}_visibility`} defaultValue={visibility} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
          <option value="">Inherit</option>
          <option value="show">Show</option>
          <option value="hide">Hide</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${prefix}_shipping`} className="text-xs">Shipping, AMD minor units</Label>
        <Input id={`${prefix}_shipping`} name={`${prefix}_shipping`} type="number" min="0" step="1" defaultValue={rule?.shipping_rate_cents ?? ''} placeholder="Unavailable" />
      </div>
    </div>
  );
}
