import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for currency smoke.',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { data: currencies, error: currencyError } = await supabase
  .from('currencies')
  .select('code, is_enabled, is_default, payment_route')
  .order('sort_order', { ascending: true });
if (currencyError) throw new Error(currencyError.message);

const codes = new Set(currencies.map((currency) => currency.code));
for (const code of ['AMD', 'EUR', 'USD']) {
  assert(codes.has(code), `Missing supported currency ${code}`);
}

const defaultCurrency = currencies.find((currency) => currency.is_default);
assert(defaultCurrency?.code === 'AMD', 'AMD must be the default currency');
assert(defaultCurrency.is_enabled, 'Default currency must be enabled');
for (const code of ['AMD', 'EUR', 'USD']) {
  const route = currencies.find((currency) => currency.code === code)?.payment_route;
  assert(
    route === 'ameria' || route === 'bank_manual',
    `${code} must route to ameria or bank_manual, got ${route}`,
  );
}

const { data: rates, error: ratesError } = await supabase
  .from('exchange_rates')
  .select('base_currency, target_currency, rate, rate_date, is_stale')
  .eq('base_currency', 'AMD');
if (ratesError) throw new Error(ratesError.message);

for (const code of ['AMD', 'EUR', 'USD']) {
  assert(
    rates.some((rate) => rate.target_currency === code && Number(rate.rate) > 0),
    `Missing AMD to ${code} cached rate`,
  );
}

const previousStates = currencies.map((currency) => ({
  code: currency.code,
  is_enabled: currency.is_enabled,
}));

try {
  const { error } = await supabase
    .from('currencies')
    .update({ is_enabled: false })
    .in('code', ['AMD', 'EUR', 'USD']);
  assert(error, 'Disabling every currency should fail');
} finally {
  for (const state of previousStates) {
    const { error } = await supabase
      .from('currencies')
      .update({ is_enabled: state.is_enabled })
      .eq('code', state.code);
    if (error) throw new Error(error.message);
  }
}

console.log('Currency smoke passed');
