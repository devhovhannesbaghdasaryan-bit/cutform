'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin';
import { updateGeneratedReviewStatus } from '@/lib/generated-items';
import { writeAdminAuditLog } from '@/lib/transactions';

const reviewSchema = z.object({
  generatedItemId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected', 'review_required']),
  note: z.string().trim().optional(),
});

export async function reviewGeneratedItemAction(formData: FormData) {
  const parsed = reviewSchema.safeParse({
    generatedItemId: formData.get('generatedItemId'),
    decision: formData.get('decision'),
    note: formData.get('note') ?? undefined,
  });

  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid review action.');

  const { supabase, user } = await requireAdmin();
  const { generatedItemId, decision, note } = parsed.data;

  await updateGeneratedReviewStatus(supabase, generatedItemId, decision);
  await writeAdminAuditLog(supabase, {
    actorUserId: user.id,
    action: `generated_item_${decision}`,
    entityType: 'generated_item',
    entityId: generatedItemId,
    reason: note || null,
    metadata: { reviewStatus: decision },
  });

  revalidatePath('/admin/generated');
  revalidatePath(`/admin/generated/${generatedItemId}`);
}
