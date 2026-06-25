import { z } from 'zod';

export const manufacturingProcessSchema = z.enum([
  'additive_fff',
  'cnc_routing',
  'laser_cutting',
  'laser_welding',
  'uv_printing',
  'eco_solvent_printing',
  'vinyl_cutting',
  'sheet_metal_bending',
  'fiber_laser_cutting',
  'band_saw_cutting',
  'tube_bending',
  'dust_collection',
]);

export const capabilityConfidenceSchema = z.enum(['confirmed', 'quoted', 'assumed', 'needs_manual']);

export const numericRangeSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  unit: z.string(),
  confidence: capabilityConfidenceSchema,
});

export const workEnvelopeSchema = z.object({
  xMm: z.number().nullable(),
  yMm: z.number().nullable(),
  zMm: z.number().nullable(),
  widthMm: z.number().nullable(),
  lengthMm: z.number().nullable(),
  heightMm: z.number().nullable(),
  diameterMm: z.number().nullable(),
  notes: z.string().optional(),
  confidence: capabilityConfidenceSchema,
});

export const manufacturingToolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  model: z.string().nullable(),
  source: z.object({
    quotePdf: z.string().optional(),
    userProvided: z.boolean().default(false),
    webSources: z.array(z.string()).default([]),
  }),
  process: manufacturingProcessSchema,
  role: z.enum(['primary_production', 'support', 'finishing']),
  status: z.enum(['available', 'quoted_candidate', 'needs_confirmation']),
  materials: z.array(z.string()).default([]),
  operations: z.array(z.string()).default([]),
  workEnvelope: workEnvelopeSchema.nullable(),
  power: z
    .object({
      value: z.number(),
      unit: z.string(),
      confidence: capabilityConfidenceSchema,
    })
    .nullable(),
  inputFormats: z.array(z.string()).default([]),
  software: z.array(z.string()).default([]),
  hardLimits: z.array(z.string()).default([]),
  designRules: z.array(z.string()).default([]),
  setupRequirements: z.array(z.string()).default([]),
  safetyRequirements: z.array(z.string()).default([]),
  goodUseCases: z.array(z.string()).default([]),
  poorUseCases: z.array(z.string()).default([]),
  rag: z.object({
    manualSearchStatus: z.enum(['found', 'candidate_found', 'needs_vendor_manual', 'not_searched']),
    preferredDocuments: z.array(z.string()).default([]),
    missingDocuments: z.array(z.string()).default([]),
    ingestionTags: z.array(z.string()).default([]),
  }),
  notes: z.string().optional(),
});

export const manufacturingKnowledgeBaseSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  currency: z.string(),
  tools: z.array(manufacturingToolSchema),
});

export type ManufacturingTool = z.infer<typeof manufacturingToolSchema>;
export type ManufacturingKnowledgeBase = z.infer<typeof manufacturingKnowledgeBaseSchema>;
