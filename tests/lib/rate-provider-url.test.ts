import { describe, expect, it } from 'vitest';
import { buildRateProviderUrl } from '@/lib/currency';

describe('buildRateProviderUrl', () => {
  it('substitutes apiKey and base for the ExchangeRate-API v6 template', () => {
    const url = buildRateProviderUrl(
      'https://v6.exchangerate-api.com/v6/{apiKey}/latest/{base}',
      'secret-key',
      'AMD',
      'USD',
    );
    expect(url).toBe('https://v6.exchangerate-api.com/v6/secret-key/latest/AMD');
  });

  it('substitutes {target} for legacy templates and tolerates a missing key', () => {
    const url = buildRateProviderUrl('https://open.er-api.com/v6/latest/{base}', undefined, 'AMD', 'USD');
    expect(url).toBe('https://open.er-api.com/v6/latest/AMD');
  });
});
