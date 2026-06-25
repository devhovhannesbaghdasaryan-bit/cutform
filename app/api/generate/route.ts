import { NextResponse, type NextRequest } from 'next/server';
import { streamText, Output } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase/server';
import { generationSchema } from '@/lib/generation-schema';
import { getCreditBalance } from '@/lib/credits';

export const runtime = 'nodejs';
export const maxDuration = 60;

const bodySchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  imageBase64: z.string().min(1),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
});

const SYSTEM_PROMPT = `You are a vector designer who turns reference images into manufacturable SVGs for laser cutters, vinyl cutters, and CNC machines.

Rules for the SVG:
- Output a single complete <svg>...</svg> with a viewBox.
- Use closed paths and clean Bezier curves. Simplify aggressively.
- Strokes: keep them open and at least 1 unit wide. Cuts should be continuous.
- No rasters, no gradients with stops, no embedded images, no external href references.
- No <script>, no event handlers, no <foreignObject>.
- Black fill or stroke on transparent background unless the user requests otherwise.

Rules for the title:
- 2 to 5 words. Concrete, not generic. No quotes.

Rules for the explanation:
- One or two sentences. Mention any simplifications you made.`;

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const balance = await getCreditBalance(supabase, user.id).catch(() => 0);
  if (balance < 1) {
    return NextResponse.json({ error: 'Insufficient credit balance.' }, { status: 402 });
  }

  const { data: session, error: sessionErr } = await supabase
    .from('generation_sessions')
    .select('id, user_id, input_units, output_units')
    .eq('id', parsed.sessionId)
    .single();
  if (sessionErr || !session) return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  if (session.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const dataUrl = `data:${parsed.mimeType};base64,${parsed.imageBase64}`;

  const result = streamText({
    model: openai('gpt-4o'),
    output: Output.object({ schema: generationSchema }),
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: parsed.message },
          { type: 'image', image: dataUrl },
        ],
      },
    ],
    onFinish: async ({ usage }) => {
      // Stream completed — read the final structured object from result.output
      // (a promise that resolves to the validated object).
      const object = await result.output;
      if (!object) return;
      await supabase
        .from('generation_sessions')
        .update({
          input_units: session.input_units + (usage?.inputTokens ?? 0),
          output_units: session.output_units + (usage?.outputTokens ?? 0),
          last_title: object.title,
          last_svg: object.svg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);
    },
  });

  return result.toTextStreamResponse();
}
