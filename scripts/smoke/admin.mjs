import { existsSync, readFileSync } from 'node:fs';

const requiredRoutes = [
  'app/admin/page.tsx',
  'app/admin/create/page.tsx',
  'app/personalization/page.tsx',
  'app/personalization/night-lights/page.tsx',
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

const adminActions = readFileSync('app/admin/actions.ts', 'utf8');
for (const action of ['createCatalogItemAction', 'updateCatalogItemAction', 'generateCatalogItemSeoDraftAction']) {
  if (!adminActions.includes(action)) throw new Error(`Missing admin action: ${action}`);
}

for (const removedRoute of [
  'app/admin/banner-samples/page.tsx',
  'app/admin/personalization-models/page.tsx',
  'app/create/page.tsx',
  'app/api/generate/route.ts',
]) {
  if (existsSync(removedRoute)) throw new Error(`Retired route still exists: ${removedRoute}`);
}

const personalizationActions = readFileSync('app/personalization/night-lights/actions.ts', 'utf8');
for (const action of ['savePersonalizationBoilerplateAction', 'removePersonalizationBoilerplateAction']) {
  if (!personalizationActions.includes(action)) throw new Error(`Missing personalization admin action: ${action}`);
}

const personalizationPage = readFileSync('app/personalization/night-lights/page.tsx', 'utf8');
for (const contract of ['ImageUploadField', 'mockImagePath', 'boilerplateImagePath', 'resolvePublicStorageUrl']) {
  if (!personalizationPage.includes(contract)) throw new Error(`Missing personalization image contract: ${contract}`);
}

const generatedDetail = readFileSync('app/admin/generated/[id]/page.tsx', 'utf8');
for (const contract of [
  "from('user-uploads').createSignedUrl",
  "from('generated-assets').createSignedUrl",
  'Generated preview',
  'Manufacturing PNG',
  'ManufacturingSvgForm',
]) {
  if (!generatedDetail.includes(contract)) throw new Error(`Admin generated detail is missing asset rendering: ${contract}`);
}

const generatedActions = readFileSync('app/admin/generated/actions.ts', 'utf8');
for (const contract of ['generateManufacturingSvgAction', 'openai.image(settings.model)', "from('generated-assets')", 'manufacturing-png']) {
  if (!generatedActions.includes(contract)) throw new Error(`Admin manufacturing PNG generation is missing: ${contract}`);
}

console.log('Admin smoke passed');
