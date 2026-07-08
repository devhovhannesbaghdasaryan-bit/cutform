'use client';

import { FileImage, Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import {
  generateManufacturingSvgAction,
  type ManufacturingSvgGenerationState,
} from '@/app/admin/generated/actions';

interface ManufacturingSvgFormProps {
  generatedItemId: string;
  optionId: string;
  hasExistingSvg: boolean;
}

const initialState: ManufacturingSvgGenerationState = { status: 'idle', message: null };

export function ManufacturingSvgForm({
  generatedItemId,
  optionId,
  hasExistingSvg,
}: ManufacturingSvgFormProps) {
  const [state, action, pending] = useActionState(generateManufacturingSvgAction, initialState);

  return (
    <form action={action} className="min-w-0 space-y-3">
      <input type="hidden" name="generatedItemId" value={generatedItemId} />
      <input type="hidden" name="optionId" value={optionId} />

      {state.message ? (
        <p
          role="status"
          className={`text-sm ${state.status === 'error' ? 'text-destructive' : 'text-success'}`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-md border px-4 py-2 text-center text-sm font-medium hover:bg-muted disabled:opacity-60 sm:w-auto"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <FileImage className="size-4" aria-hidden="true" />
        )}
        {pending
          ? 'Tracing PNG to SVG…'
          : hasExistingSvg
            ? 'Regenerate manufacturing SVG'
            : 'Convert manufacturing PNG to SVG'}
      </button>
    </form>
  );
}
