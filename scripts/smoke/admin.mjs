import { existsSync, readFileSync } from 'node:fs';

const requiredRoutes = [
  'app/admin/page.tsx',
  'app/admin/create/page.tsx',
  'app/admin/items/new/page.tsx',
  'app/admin/items/[id]/page.tsx',
  'app/admin/users/page.tsx',
  'app/admin/transactions/page.tsx',
  'app/admin/currencies/page.tsx',
  'app/admin/banner-samples/page.tsx',
  'app/admin/personalization-models/page.tsx',
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

console.log('Admin smoke passed');
