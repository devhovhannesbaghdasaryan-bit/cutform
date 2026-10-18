'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import {
  generateManufacturingSvgAction,
  type ManufacturingSvgGenerationState,
} from '@/app/admin/generated/actions';

interface ManufacturingSvgFormProps {
  generatedItemId: string;
  optionId: string;
  hasExistingSvg: boolean;
  /** Primary styling when tracing is the next step rather than a redo. */
  primary?: boolean;
}

const initialState: ManufacturingSvgGenerationState = { status: 'idle', message: null };

export function ManufacturingSvgForm({
  generatedItemId,
  optionId,
  hasExistingSvg,
  primary = false,
}: ManufacturingSvgFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(generateManufacturingSvgAction, initialState);
  const buttonStyle = primary
    ? 'bg-primary text-primary-foreground'
    : 'border text-foreground hover:bg-muted';

  return (
    <form action={action} className="flex min-w-0 flex-wrap items-center gap-3">
      <input type="hidden" name="generatedItemId" value={generatedItemId} />
      <input type="hidden" name="optionId" value={optionId} />

      <button
        type="submit"
        disabled={pending}
        className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold disabled:opacity-60 ${buttonStyle}`}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-4" aria-hidden="true" />
        )}
        {pending
          ? t('adminGenerated.svgForm.tracing')
          : hasExistingSvg
            ? t('adminGenerated.svgForm.retrace')
            : t('adminGenerated.svgForm.trace')}
      </button>

      {state.message ? (
        <p
          role="status"
          className={`text-sm ${state.status === 'error' ? 'text-destructive' : 'text-success'}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
