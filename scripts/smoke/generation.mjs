import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'app/create/night-light/page.tsx',
  'app/create/laser-cut-2d/page.tsx',
  'lib/night-light-generation.ts',
  'lib/laser-cut-2d-generation.ts',
  'components/night-light-preview.tsx',
  'components/wood-2d-preview.tsx',
  'lib/sanitize.ts',
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing generation file: ${file}`);
}

const sanitize = readFileSync('lib/sanitize.ts', 'utf8');
for (const warning of ['missing a viewBox', 'missing obvious cut/engrave layer markers']) {
  if (!sanitize.includes(warning)) throw new Error(`Missing SVG warning: ${warning}`);
}

const generatedDetail = readFileSync('app/generated/[id]/page.tsx', 'utf8');
if (!generatedDetail.includes('Manufacturability warnings')) {
  throw new Error('Generated detail page does not show manufacturability warnings');
}

console.log('Generation smoke passed');
