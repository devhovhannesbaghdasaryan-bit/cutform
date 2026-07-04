import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const baseUrl = (process.env.SNIP_SMOKE_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const chromePath =
  process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = Number(process.env.SNIP_CHROME_DEBUG_PORT ?? 9333);
const runId = `ui-${Date.now()}`;
const createdUserIds = [];

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for UI workflow smoke.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition, label, timeoutMs = 10000) {
  const started = Date.now();
  let lastValue = null;

  while (Date.now() - started < timeoutMs) {
    lastValue = await condition();
    if (lastValue) return lastValue;
    await wait(250);
  }

  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(lastValue)}`);
}

async function connectBrowser() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'snip-ui-smoke-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--disable-gpu-compositing',
    '--disable-software-rasterizer',
    '--disable-features=VizDisplayCompositor',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], {
    stdio: 'ignore',
    windowsHide: true,
  });

  const pages = await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.length ? data : null;
    } catch {
      return null;
    }
  }, 'Chrome debugging endpoint');

  const page = pages.find((target) => target.type === 'page' && target.url === 'about:blank')
    ?? pages.find((target) => target.type === 'page');
  assert(page, 'Chrome did not expose a page debugging target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const pending = new Map();
  let seq = 0;

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (!pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  function send(method, params = {}) {
    return Promise.race([
      new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${method} timed out`)), 10000)),
    ]);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  return {
    chrome,
    ws,
    send,
    close: async () => {
      try {
        ws.close();
      } catch {
        // ignore shutdown races
      }
      chrome.kill();
      await wait(300);
      rmSync(userDataDir, { recursive: true, force: true });
    },
  };
}

function scriptExpression(source) {
  return `(() => { ${source} })()`;
}

async function evaluate(browser, source) {
  const result = await browser.send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression: scriptExpression(source),
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? 'Browser evaluation failed');
  }

  return result.result.value;
}

async function navigate(browser, path) {
  const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
  await browser.send('Page.navigate', { url });
  await waitFor(
    () => evaluate(browser, 'return document.readyState === "complete";'),
    `page load ${url}`,
  );
  await wait(500);
}

async function bodyText(browser) {
  return evaluate(browser, 'return document.body.innerText;');
}

async function waitForText(browser, expected, label = expected) {
  let lastText = '';
  try {
    return await waitFor(async () => {
      lastText = await bodyText(browser);
      return lastText.includes(expected) ? lastText : null;
    }, label);
  } catch (error) {
    throw new Error(`${error.message}. Current body text: ${lastText.slice(0, 500)}`);
  }
}

async function clickByText(browser, text) {
  const clicked = await evaluate(browser, `
    const text = ${JSON.stringify(text)};
    const candidates = [...document.querySelectorAll('a, button')];
    const element = candidates.find((node) => node.innerText.trim().includes(text));
    if (!element) return false;
    element.click();
    return true;
  `);
  assert(clicked, `Expected clickable text: ${text}`);
  await wait(900);
}

async function fillInput(browser, name, value) {
  const filled = await evaluate(browser, `
    const field = document.querySelector(${JSON.stringify(`input[name="${name}"], textarea[name="${name}"]`)});
    if (!field) return false;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
    field.focus();
    setter ? setter.call(field, ${JSON.stringify(value)}) : field.value = ${JSON.stringify(value)};
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  assert(filled, `Expected input named ${name}`);
}

async function checkInput(browser, name) {
  const checked = await evaluate(browser, `
    const input = document.querySelector(${JSON.stringify(`input[name="${name}"]`)});
    if (!input) return false;
    if (!input.checked) input.click();
    return input.checked;
  `);
  assert(checked, `Expected checkbox named ${name}`);
}

async function submitCurrentForm(browser) {
  const submitted = await evaluate(browser, `
    const button = document.querySelector('button[type="submit"]');
    if (!button) return false;
    button.click();
    return true;
  `);
  assert(submitted, 'Expected a submit button on current page');
  await wait(1500);
}

async function createQaUser(label, role = 'user') {
  const email = `${runId}-${label}@example.test`;
  const password = `Qa-${runId}-123456!`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: `${label} ${runId}` },
  });

  if (error || !data.user) throw new Error(error?.message ?? `Unable to create ${label} user`);
  createdUserIds.push(data.user.id);

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: data.user.id,
        role,
        status: 'active',
        preferred_locale: 'en',
        display_name: `${label} ${runId}`,
        internal_notes: runId,
      },
      { onConflict: 'user_id' },
    );
  if (profileError) throw new Error(profileError.message);

  if (role === 'admin') {
    const permissions = [
      'catalog_manage',
      'seo_manage',
      'orders_manage',
      'generated_review',
      'users_manage',
      'transactions_manage',
      'balances_adjust',
    ].map((permission) => ({ user_id: data.user.id, permission }));
    const { error: permissionError } = await supabase.from('admin_permissions').upsert(permissions);
    if (permissionError) throw new Error(permissionError.message);
  }

  const { error: creditError } = await supabase
    .from('credit_accounts')
    .upsert({ user_id: data.user.id, balance: 40 }, { onConflict: 'user_id' });
  if (creditError) throw new Error(creditError.message);

  return { id: data.user.id, email, password };
}

async function login(browser, user, next = '/dashboard') {
  await navigate(browser, `/en/login?next=${encodeURIComponent(next)}`);
  await waitForText(browser, 'Log in', 'login screen');
  await fillInput(browser, 'email', user.email);
  await fillInput(browser, 'password', user.password);
  await submitCurrentForm(browser);
}

async function runGuestAndCustomerFlow(customerUser) {
  const browser = await connectBrowser();
  try {
    await navigate(browser, '/en');
    let text = await waitForText(browser, 'Wooden gifts', 'landing hero text');

    await clickByText(browser, 'RU');
    await waitFor(
      () => evaluate(browser, 'return document.cookie.includes("snip_locale=ru");'),
      'ru locale cookie',
    );

    await navigate(browser, '/en/catalog');
    text = await waitForText(browser, 'Marketplace catalog', 'catalog page title');

    const addedTitle = await evaluate(browser, `
      const form = [...document.querySelectorAll('form')].find((node) => node.querySelector('button[aria-label^="Add "]'));
      if (!form) return null;
      const card = form.closest('[class*="rounded"]') ?? form.parentElement;
      const title = card?.innerText?.split('\\n').find((line) => line.trim().length > 0) ?? 'Catalog item';
      form.querySelector('button').click();
      return title.trim();
    `);
    assert(addedTitle, 'Could not click catalog add-to-cart button');
    await wait(1200);

    await navigate(browser, '/en/cart');
    text = await waitFor(async () => {
      const current = await bodyText(browser);
      return current.includes('Your cart is empty') ? null : current;
    }, 'cart item after add');

    await login(browser, customerUser, '/cart');
    text = await waitFor(async () => {
      const current = await bodyText(browser);
      return current.includes('Shopping cart') && !current.includes('Your cart is empty') ? current : null;
    }, 'merged customer cart after login');
    assert(text.includes('Checkout review'), 'Logged-in cart did not show checkout review');

    await navigate(browser, '/en/dashboard');
    text = await waitForText(browser, 'Your products', 'customer dashboard');
    assert(text.includes('Credits'), 'Customer dashboard did not show credit balance');

    await navigate(browser, '/en/catalog');
    await waitForText(browser, 'Marketplace catalog', 'catalog page after login');
    await navigate(browser, '/en/cart');
    text = await bodyText(browser);

    const updated = await evaluate(browser, `
      const input = document.querySelector('input[name="quantity"]');
      if (!input) return false;
      input.value = '2';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const updateButton = [...document.querySelectorAll('button')].find((button) => button.innerText.includes('Update'));
      updateButton?.click();
      return Boolean(updateButton);
    `);
    assert(updated, 'Could not update cart quantity');
    await wait(1200);

    const removed = await evaluate(browser, `
      const removeButton = [...document.querySelectorAll('button')].find((button) => button.innerText.includes('Remove'));
      removeButton?.click();
      return Boolean(removeButton);
    `);
    assert(removed, 'Could not remove cart item');
    await wait(1200);
    text = await bodyText(browser);
    assert(text.includes('Your cart is empty'), 'Cart was not empty after removing the item');

    await navigate(browser, '/en/banners');
    text = await waitForText(browser, 'Banners for stores', 'banners page title');
    assert(text.includes('Advanced AI banner'), 'Advanced banner generation UI was not visible');
    assert(text.includes('Review customized banner'), 'Banner sample customization form was not visible');

    await fillInput(browser, 'bannerText', `${runId} launch sale`);
    await clickByText(browser, 'Review customized banner');
    text = await waitForText(browser, 'Add selected result to cart', 'customized banner detail');
    assert(text.includes('banner'), 'Customized banner detail did not render banner configuration');

    await clickByText(browser, 'Add selected result to cart');
    text = await waitForText(browser, 'Shopping cart', 'cart after customized banner');
    assert(text.includes('Generated item'), 'Customized banner was not added as a generated cart item');

    await navigate(browser, '/en/checkout');
    text = await waitForText(browser, 'Checkout review', 'checkout review for generated banner');
    assert(text.includes('Order items') && text.includes('Create order'), 'Checkout review did not render order creation controls');

    await navigate(browser, '/en/banners');
    await waitForText(browser, 'Advanced AI banner', 'advanced banner form');
    await fillInput(browser, 'prompt', `${runId} grand opening window banner in warm brand colors`);
    await checkInput(browser, 'uploadRightsConfirmed');
    await clickByText(browser, 'Generate with credits');
    text = await waitForText(browser, 'Add selected result to cart', 'advanced generated banner detail');
    assert(text.includes('5 credits'), 'Advanced banner generation did not record credit cost');

    await navigate(browser, '/en/catalog/night-lights/personalized');
    text = await waitForText(browser, 'Personalized night lights', 'personalized listing title');
    assert(text.includes('Personalized'), 'Personalized model/subcategory content was not visible');

    const personalizeHref = await evaluate(browser, `
      const link = [...document.querySelectorAll('a')].find((node) => node.href.includes('/personalize/'));
      return link?.pathname ?? null;
    `);
    assert(personalizeHref, 'Personalized model link was not visible');

    await navigate(browser, personalizeHref);
    text = await bodyText(browser);
    assert(
      text.includes('Upload') || text.includes('Generate') || text.includes('Personalization'),
      'Authenticated personalized model page did not show a generation form',
    );
  } finally {
    await browser.close();
  }
}

async function runAdminFlow(adminUser) {
  const browser = await connectBrowser();
  try {
    await login(browser, adminUser, '/admin');
    let text = await waitForText(browser, 'Admin panel', 'admin dashboard');
    assert(text.includes('Transactions'), 'Admin dashboard did not show admin navigation');

    const adminRoutes = [
      ['/en/admin/users', 'Users'],
      ['/en/admin/transactions', 'Transactions'],
      ['/en/admin/items', 'Items'],
      ['/en/admin/orders', 'Orders'],
      ['/en/admin/generated', 'Generated items'],
      ['/en/personalization', 'Personalization'],
      ['/en/personalization/night-lights', 'Night light templates'],
    ];

    for (const [route, expected] of adminRoutes) {
      await navigate(browser, route);
      text = await waitForText(browser, expected, route);
      assert(!text.includes('Welcome back'), `${route} redirected to login`);
      assert(!text.includes('Your products'), `${route} redirected to dashboard`);
    }
  } finally {
    await browser.close();
  }
}

async function cleanup() {
  for (const userId of createdUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
}

try {
  const customerUser = await createQaUser('customer');
  const adminUser = await createQaUser('admin', 'admin');
  await runGuestAndCustomerFlow(customerUser);
  await runAdminFlow(adminUser);
  console.log('UI workflow smoke passed');
} finally {
  await cleanup();
}
