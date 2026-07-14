import { existsSync, readFileSync } from 'node:fs';

const requiredRoutes = [
  'app/admin/page.tsx',
  'app/admin/create/page.tsx',
  'app/admin/personalization/page.tsx',
  'app/admin/personalization/boilerplates/page.tsx',
  'app/admin/items/new/page.tsx',
  'app/admin/items/[id]/page.tsx',
  'app/admin/users/page.tsx',
  'app/admin/transactions/page.tsx',
  'app/admin/currencies/page.tsx',
  'app/admin/generated/page.tsx',
  'app/admin/orders/[id]/page.tsx',
];

for (const route of requiredRoutes) {
  if (!existsSync(route)) throw new Error(`Missing admin route: ${route}`);
}

const catalogActions = readFileSync('app/admin/items/actions.ts', 'utf8');
for (const action of ['createCatalogItemAction', 'updateCatalogItemAction']) {
  if (!catalogActions.includes(action)) throw new Error(`Missing admin action: ${action}`);
}

const itemAiLib = readFileSync('lib/item-ai.ts', 'utf8');
if (!itemAiLib.includes('generateItemFields')) {
  throw new Error('Missing item AI helper: generateItemFields');
}

const aiFillActions = readFileSync('app/admin/items/ai-fill-actions.ts', 'utf8');
if (!aiFillActions.includes('generateItemFieldValuesAction')) {
  throw new Error('Missing admin action: generateItemFieldValuesAction');
}

for (const removedRoute of [
  'app/admin/banner-samples/page.tsx',
  'app/admin/personalization-models/page.tsx',
  'app/admin/actions.ts',
  'app/create/page.tsx',
  'app/api/generate/route.ts',
  'app/personalization/page.tsx',
  'app/personalization/night-lights/page.tsx',
  'app/admin/personalization/night-lights/page.tsx',
  'app/admin/personalization/night-lights/actions.ts',
]) {
  if (existsSync(removedRoute)) throw new Error(`Retired route still exists: ${removedRoute}`);
}

const personalizationActions = readFileSync('app/admin/personalization/boilerplates/actions.ts', 'utf8');
for (const action of [
  'saveBoilerplateAction',
  'removeBoilerplateAction',
  'uploadReferenceImage',
  'deleteReferenceFile',
]) {
  if (!personalizationActions.includes(action)) throw new Error(`Missing personalization admin action: ${action}`);
}

const personalizationPage = readFileSync('app/admin/personalization/boilerplates/page.tsx', 'utf8');
for (const contract of ['BoilerplateForm', 'saveBoilerplateAction', 'resolvePublicStorageUrl', 'openai_file_id']) {
  if (!personalizationPage.includes(contract)) throw new Error(`Missing personalization image contract: ${contract}`);
}

const generatedDetail = readFileSync('app/admin/generated/[id]/page.tsx', 'utf8');
for (const contract of [
  'getGeneratedItemAdminDetail',
  'Generated preview',
  'Manufacturing PNG',
  'ManufacturingFileForm',
]) {
  if (!generatedDetail.includes(contract)) throw new Error(`Admin generated detail is missing asset rendering: ${contract}`);
}

const generatedItemsLib = readFileSync('lib/generated-items.ts', 'utf8');
for (const contract of [
  "from('user-uploads').createSignedUrl",
  "from('generated-assets').createSignedUrl",
]) {
  if (!generatedItemsLib.includes(contract)) throw new Error(`Generated item admin detail is missing signed asset URLs: ${contract}`);
}

const generatedActions = readFileSync('app/admin/generated/actions.ts', 'utf8');
for (const contract of ['generateManufacturingFileAction', 'openai.image(settings.model)', "'generated-assets'", 'manufacturing-png']) {
  if (!generatedActions.includes(contract)) throw new Error(`Admin manufacturing PNG generation is missing: ${contract}`);
}

console.log('Admin smoke passed');
