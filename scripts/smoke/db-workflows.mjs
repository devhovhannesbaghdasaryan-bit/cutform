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
    'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for db workflow smoke.',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = `qa-${Date.now()}`;
const createdUserIds = [];
const createdOrderIds = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createQaUser(label) {
  const email = `${runId}-${label}@example.test`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: `Qa-${runId}-123456!`,
    email_confirm: true,
    user_metadata: { display_name: `${label} ${runId}` },
  });

  if (error || !data.user) throw new Error(error?.message ?? `Unable to create ${label} user`);
  createdUserIds.push(data.user.id);
  return data.user;
}

async function maybeSingle(table, query) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function insertSingle(table, payload, select = 'id') {
  const { data, error } = await supabase.from(table).insert(payload).select(select).single();
  if (error || !data) throw new Error(`${table}: ${error?.message ?? 'insert failed'}`);
  return data;
}

async function cleanup() {
  for (const orderId of createdOrderIds) {
    await supabase.from('orders').delete().eq('id', orderId);
  }

  for (const userId of createdUserIds) {
    await supabase.auth.admin.deleteUser(userId);
  }
}

try {
  const [adminUser, customerUser] = await Promise.all([
    createQaUser('admin'),
    createQaUser('customer'),
  ]);

  const [{ error: adminProfileError }, { error: customerProfileError }] = await Promise.all([
    supabase
      .from('profiles')
      .update({ role: 'admin', status: 'active', preferred_locale: 'en', internal_notes: runId })
      .eq('user_id', adminUser.id),
    supabase
      .from('profiles')
      .update({ role: 'user', status: 'active', preferred_locale: 'ru', internal_notes: runId })
      .eq('user_id', customerUser.id),
  ]);
  if (adminProfileError) throw new Error(adminProfileError.message);
  if (customerProfileError) throw new Error(customerProfileError.message);

  const catalogItem = await maybeSingle(
    'catalog_items',
    supabase
      .from('catalog_items')
      .select('id, title, price_cents, currency')
      .eq('status', 'published')
      .limit(1),
  );
  assert(catalogItem, 'Expected at least one published catalog item');

  const sessionId = `${runId}-session`;
  const sessionCart = await insertSingle('carts', { session_id: sessionId, status: 'active' });
  await insertSingle('cart_items', {
    cart_id: sessionCart.id,
    catalog_item_id: catalogItem.id,
    title: catalogItem.title,
    quantity: 1,
    unit_price_cents: catalogItem.price_cents,
    currency: catalogItem.currency,
    configuration: { source: 'guest-cart-smoke', runId },
  });

  const userCart = await insertSingle('carts', { user_id: customerUser.id, status: 'active' });
  const { data: guestItems, error: guestItemsError } = await supabase
    .from('cart_items')
    .select(
      'catalog_item_id, generated_item_id, banner_sample_id, title, quantity, unit_price_cents, currency, configuration',
    )
    .eq('cart_id', sessionCart.id);
  if (guestItemsError) throw new Error(guestItemsError.message);
  assert(guestItems?.length === 1, 'Expected one guest cart item before merge');

  const { error: mergeInsertError } = await supabase.from('cart_items').insert(
    guestItems.map((item) => ({
      ...item,
      cart_id: userCart.id,
      configuration: { ...item.configuration, mergedFromSession: sessionId },
    })),
  );
  if (mergeInsertError) throw new Error(mergeInsertError.message);

  const { error: convertedError } = await supabase
    .from('carts')
    .update({ status: 'converted' })
    .eq('id', sessionCart.id);
  if (convertedError) throw new Error(convertedError.message);

  const mergedItems = await supabase.from('cart_items').select('id').eq('cart_id', userCart.id);
  if (mergedItems.error) throw new Error(mergedItems.error.message);
  assert(mergedItems.data?.length === 1, 'Expected merged user cart item');

  const { error: creditAccountError } = await supabase
    .from('credit_accounts')
    .upsert({ user_id: customerUser.id, balance: 15 }, { onConflict: 'user_id' });
  if (creditAccountError) throw new Error(creditAccountError.message);

  const creditLedger = await insertSingle(
    'credit_ledger',
    {
      user_id: customerUser.id,
      delta: 10,
      reason: 'admin_adjustment',
      reference_type: 'db_workflow_smoke',
    },
    'id',
  );

  const transaction = await insertSingle('transactions', {
    user_id: customerUser.id,
    credit_ledger_id: creditLedger.id,
    type: 'manual_adjustment',
    status: 'succeeded',
    amount_cents: 0,
    provider: null,
    provider_reference: null,
    admin_reason: 'DB workflow smoke adjustment',
    metadata: { runId, providerSafe: true },
    created_by: adminUser.id,
  });

  await insertSingle('admin_audit_log', {
    actor_user_id: adminUser.id,
    target_user_id: customerUser.id,
    action: 'db_workflow_smoke_adjustment',
    entity_type: 'transaction',
    entity_id: transaction.id,
    reason: 'DB workflow smoke adjustment',
    metadata: { runId },
  });

  const generatedItem = await insertSingle('generated_items', {
    user_id: customerUser.id,
    generated_by: customerUser.id,
    product_type: 'personalized_night_light',
    title: `Personalized smoke ${runId}`,
    prompt: 'DB smoke personalized night light',
    custom_text: 'QA smoke',
    svg_content:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10h80v80H10z"/></svg>',
    preview_path: `generated/${runId}/preview.png`,
    selected_preview_path: `generated/${runId}/selected.png`,
    manufacturing_file_path: `generated/${runId}/manufacturing.png`,
    original_image_paths: [`uploads/${runId}/original-1.png`, `uploads/${runId}/original-2.png`],
    color: 'warm_white',
    multi_color: false,
    manufacturing_metadata: { material: 'acrylic', runId },
    generation_options: { ledColor: 'warm_white', boilerplateImagePending: true },
    credit_cost: 3,
    review_status: 'preview_ready',
  });

  await insertSingle('personalized_preview_options', {
    generated_item_id: generatedItem.id,
    option_index: 1,
    preview_image_path: `generated/${runId}/selected.png`,
    manufacturing_file_path: `generated/${runId}/manufacturing.png`,
    status: 'selected',
    metadata: { runId },
  });

  await insertSingle('cart_items', {
    cart_id: userCart.id,
    generated_item_id: generatedItem.id,
    title: `Personalized smoke ${runId}`,
    quantity: 1,
    unit_price_cents: 5900,
    currency: 'USD',
    configuration: { productType: 'personalized_night_light', runId },
  });

  const cartItemsForOrder = await supabase
    .from('cart_items')
    .select(
      'id, catalog_item_id, generated_item_id, title, quantity, unit_price_cents, currency, configuration',
    )
    .eq('cart_id', userCart.id);
  if (cartItemsForOrder.error) throw new Error(cartItemsForOrder.error.message);
  assert(cartItemsForOrder.data.length === 2, 'Expected catalog and generated item in order cart');

  const subtotal = cartItemsForOrder.data.reduce(
    (sum, item) => sum + item.unit_price_cents * item.quantity,
    0,
  );
  const order = await insertSingle('orders', {
    user_id: customerUser.id,
    status: 'pending_payment',
    payment_status: 'unpaid',
    subtotal_cents: subtotal,
    shipping_cents: 0,
    total_cents: subtotal,
    currency: 'USD',
    destination_country_code: 'AM',
    shipping_address: {
      recipientName: 'Smoke Customer',
      phone: '+37400000000',
      addressLine1: '1 Smoke Street',
      city: 'Yerevan',
      countryCode: 'AM',
    },
    contact_email: customerUser.email,
    locale: 'ru',
    cart_id: userCart.id,
  });
  createdOrderIds.push(order.id);

  const orderRows = cartItemsForOrder.data.map((item) => {
    const isGenerated = item.generated_item_id === generatedItem.id;
    return {
      order_id: order.id,
      catalog_item_id: item.catalog_item_id,
      generated_item_id: item.generated_item_id,
      title: item.title,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      total_price_cents: item.unit_price_cents * item.quantity,
      item_snapshot: {
        title: item.title,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
        currency: item.currency,
        configuration: item.configuration,
      },
      personalization_snapshot: isGenerated
        ? {
            productType: 'personalized_night_light',
            selectedPreviewPath: `generated/${runId}/selected.png`,
            originalImagePaths: [
              `uploads/${runId}/original-1.png`,
              `uploads/${runId}/original-2.png`,
            ],
            customText: 'QA smoke',
            color: 'warm_white',
            multiColor: false,
          }
        : {},
      production_snapshot: isGenerated
        ? {
            material: 'acrylic',
            runId,
            generationOptions: { ledColor: 'warm_white', boilerplateImagePending: true },
            prompt: 'DB smoke personalized night light',
            creditCost: 3,
          }
        : {},
      image_path: isGenerated ? `generated/${runId}/selected.png` : null,
      selected_preview_path: isGenerated ? `generated/${runId}/selected.png` : null,
      manufacturing_file_path: isGenerated ? `generated/${runId}/manufacturing.png` : null,
      original_image_paths: isGenerated
        ? [`uploads/${runId}/original-1.png`, `uploads/${runId}/original-2.png`]
        : [],
      custom_text: isGenerated ? 'QA smoke' : null,
      led_color: isGenerated ? 'warm_white' : null,
      multi_color: false,
    };
  });

  const { error: orderItemsError } = await supabase.from('order_items').insert(orderRows);
  if (orderItemsError) throw new Error(orderItemsError.message);

  const orderItems = await supabase
    .from('order_items')
    .select(
      'id, title, selected_preview_path, manufacturing_file_path, original_image_paths, custom_text, led_color, personalization_snapshot, production_snapshot',
    )
    .eq('order_id', order.id);
  if (orderItems.error) throw new Error(orderItems.error.message);
  const personalizedOrderItem = orderItems.data.find((item) => item.selected_preview_path);
  assert(personalizedOrderItem, 'Expected personalized order item snapshot');
  assert(
    personalizedOrderItem.manufacturing_file_path?.endsWith('/manufacturing.png'),
    'Expected manufacturing file path on order item',
  );
  assert(
    personalizedOrderItem.original_image_paths?.length === 2,
    'Expected original image paths on order item',
  );
  assert(personalizedOrderItem.custom_text === 'QA smoke', 'Expected custom text on order item');
  assert(personalizedOrderItem.led_color === 'warm_white', 'Expected LED color on order item');

  const auditRows = await supabase
    .from('admin_audit_log')
    .select('id')
    .eq('target_user_id', customerUser.id)
    .eq('action', 'db_workflow_smoke_adjustment');
  if (auditRows.error) throw new Error(auditRows.error.message);
  assert(auditRows.data.length === 1, 'Expected admin audit row');

  const transactionRows = await supabase
    .from('transactions')
    .select('id, provider_reference')
    .eq('user_id', customerUser.id)
    .eq('type', 'manual_adjustment');
  if (transactionRows.error) throw new Error(transactionRows.error.message);
  assert(transactionRows.data.length === 1, 'Expected manual adjustment transaction');
  assert(
    transactionRows.data[0].provider_reference === null,
    'Expected provider-safe manual transaction reference',
  );

  const { error: cartConvertedError } = await supabase
    .from('carts')
    .update({ status: 'converted' })
    .eq('id', userCart.id);
  if (cartConvertedError) throw new Error(cartConvertedError.message);

  console.log(`DB workflow smoke passed: ${runId}`);
} finally {
  await cleanup();
}
