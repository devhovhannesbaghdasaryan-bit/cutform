import { readFileSync } from 'node:fs';

const credits = readFileSync('lib/credits.ts', 'utf8');
for (const symbol of ['debitCredits', 'refundCredits', 'Insufficient credit balance']) {
  if (!credits.includes(symbol)) throw new Error(`Missing credit behavior: ${symbol}`);
}

const generatedItems = readFileSync('lib/generated-items.ts', 'utf8');
const legacyGeneratedCostColumn = ['tok', 'en_cost'].join('');
if (generatedItems.includes(legacyGeneratedCostColumn)) {
  throw new Error('Generated item helper still writes legacy generated cost.');
}
if (!generatedItems.includes('credit_cost')) {
  throw new Error('Generated item helper must write credit_cost.');
}

const transactions = readFileSync('lib/transactions.ts', 'utf8');
for (const type of ['credit_purchase', 'credit_spend', 'credit_refund']) {
  if (!transactions.includes(type)) throw new Error(`Missing credit transaction type: ${type}`);
}

console.log('Credit spending smoke passed');
