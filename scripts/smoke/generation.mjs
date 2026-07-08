import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'lib/sanitize.ts',
  'components/personalized-night-light-form.tsx',
  'lib/personalization-boilerplates.ts',
  'supabase/migrations/0001_init.sql',
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing generation file: ${file}`);
}

const baselineMigration = readFileSync('supabase/migrations/0001_init.sql', 'utf8');
for (const contract of [
  'create table "public"."personalization_boilerplates"',
  '"openai_file_id" text not null',
]) {
  if (!baselineMigration.includes(contract)) {
    throw new Error(`Baseline migration is missing personalization boilerplates contract: ${contract}`);
  }
}

for (const retiredFile of [
  'app/create/page.tsx',
  'app/create/night-light/page.tsx',
  'app/create/laser-cut-2d/page.tsx',
  'app/api/generate/route.ts',
  'lib/generation-schema.ts',
]) {
  if (existsSync(retiredFile)) throw new Error(`Retired generator file still exists: ${retiredFile}`);
}

const personalizedAction = readFileSync('app/personalize/actions.ts', 'utf8');
for (const contract of [
  "formData.getAll('boilerplateIds')",
  'const creditCost = selectedBoilerplates.length',
  'reference.generate_hidden_svg',
  'manufacturingFilePath: null',
  "manufacturingSvgStatus: 'pending_admin_generation'",
  'referenceFileId: reference.openai_file_id',
]) {
  if (!personalizedAction.includes(contract)) throw new Error(`Missing personalized generation contract: ${contract}`);
}

for (const removedContract of ['createPreviewSvg(', 'uploadGeneratedSvg(', 'hiddenSvgs:', 'loadBoilerplate(']) {
  if (personalizedAction.includes(removedContract)) throw new Error(`Customer generation still creates manufacturing SVGs: ${removedContract}`);
}

const cartAction = readFileSync('app/generated/actions.ts', 'utf8');
if (!cartAction.includes("formData.getAll('optionIds')")) throw new Error('Generated results do not support multi-option carting');

const sanitize = readFileSync('lib/sanitize.ts', 'utf8');
for (const warning of ['missing a viewBox', 'missing obvious cut/engrave layer markers']) {
  if (!sanitize.includes(warning)) throw new Error(`Missing SVG warning: ${warning}`);
}

const generatedDetail = readFileSync('app/generated/[id]/page.tsx', 'utf8');
for (const contract of ['extractValidationWarnings', "t('generated.warnings')", 'getTranslations']) {
  if (!generatedDetail.includes(contract)) throw new Error(`Generated detail is missing warning rendering: ${contract}`);
}

console.log('Personalized generation smoke passed');
