// Contract smoke against the Ameriabank vPOS test environment:
// InitPayment must return a PaymentID, and GetPaymentDetails on the fresh
// payment must report a started (unpaid) state. Requires AMERIA_* env vars.
import { existsSync, readFileSync } from 'node:fs';

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

const baseUrl = (process.env.AMERIA_API_BASE_URL ?? '').replace(/\/$/, '');
const clientId = process.env.AMERIA_CLIENT_ID;
const username = process.env.AMERIA_USERNAME;
const password = process.env.AMERIA_PASSWORD;

if (!baseUrl || !clientId || !username || !password) {
  throw new Error('AMERIA_API_BASE_URL, AMERIA_CLIENT_ID, AMERIA_USERNAME and AMERIA_PASSWORD are required.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postJson(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert(response.ok, `HTTP ${response.status} from ${path}`);
  return response.json();
}

// Unique-enough OrderID inside the bank-assigned test range for a smoke run.
const orderIdBase = Number(process.env.AMERIA_ORDER_ID_BASE ?? '0');
const orderId = orderIdBase + (Date.now() % 100_000);

const init = await postJson('/api/VPOS/InitPayment', {
  ClientID: clientId,
  Username: username,
  Password: password,
  OrderID: orderId,
  Amount: 10,
  Currency: '051',
  Description: 'Uniqraft payments smoke',
  BackURL: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/payments/ameria/callback`,
  Opaque: `smoke-${orderId}`,
});

assert(Number(init.ResponseCode) === 1, `InitPayment rejected: ${init.ResponseMessage ?? init.ResponseCode}`);
assert(typeof init.PaymentID === 'string' && init.PaymentID.length > 0, 'InitPayment returned no PaymentID');
console.log(`InitPayment OK — PaymentID ${init.PaymentID}, hosted page ${baseUrl}/Payments/Pay?id=${init.PaymentID}&lang=en`);

const details = await postJson('/api/VPOS/GetPaymentDetails', {
  PaymentID: init.PaymentID,
  Username: username,
  Password: password,
});

const state = String(details.PaymentState ?? '').toLowerCase();
assert(state === '' || state.includes('started'), `Fresh payment should be in a started state, got "${state}"`);
assert(String(details.Opaque ?? '') === `smoke-${orderId}`, 'Opaque did not round-trip');
console.log(`GetPaymentDetails OK — state "${state}", Opaque round-tripped`);
console.log('payments-ameria smoke passed');
