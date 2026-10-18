'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import {
  generateManufacturingFileAction,
  type ManufacturingFileGenerationState,
} from '@/app/admin/generated/actions';

interface ManufacturingFileFormProps {
  generatedItemId: string;
  optionId: string;
  optionName: string;
  defaultPrompt: string;
  hasExistingFile: boolean;
  /** The customer preview was rendered from the current manufacturing PNG. */
  previewLinked?: boolean;
}

const initialState: ManufacturingFileGenerationState = { status: 'idle', message: null };

export function ManufacturingFileForm({
  generatedItemId,
  optionId,
  optionName,
  defaultPrompt,
  hasExistingFile,
  previewLinked = false,
}: ManufacturingFileFormProps) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(generateManufacturingFileAction, initialState);
  const fieldPrefix = `manufacturing-file-${optionId}`;

  return (
    <form action={action} className="min-w-0 space-y-4">
      <input type="hidden" name="generatedItemId" value={generatedItemId} />
      <input type="hidden" name="optionId" value={optionId} />
      {previewLinked ? null : (
        <p className="text-sm text-muted-foreground">
          {t('adminGenerated.fileForm.adminOnly', { name: optionName })}
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor={`${fieldPrefix}-prompt`} className="text-sm font-medium">
          {previewLinked
            ? t('adminGenerated.fileForm.promptCurrent')
            : t('adminGenerated.fileForm.prompt')}
        </label>
        <textarea
          id={`${fieldPrefix}-prompt`}
          name="prompt"
          defaultValue={defaultPrompt}
          rows={12}
          required
          className="min-h-64 w-full min-w-0 max-w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
        />
        <p className="text-xs text-muted-foreground">{t('adminGenerated.fileForm.promptHelp')}</p>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <Field label={t('adminGenerated.fileForm.model')} htmlFor={`${fieldPrefix}-model`}>
          <select
            id={`${fieldPrefix}-model`}
            name="model"
            defaultValue="gpt-image-2"
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="gpt-image-2">
              GPT Image 2 · {t('adminGenerated.fileForm.modelBest')}
            </option>
            <option value="gpt-image-1.5">
              GPT Image 1.5 · {t('adminGenerated.fileForm.modelBalanced')}
            </option>
            <option value="gpt-image-1">
              GPT Image 1 · {t('adminGenerated.fileForm.modelPrevious')}
            </option>
            <option value="gpt-image-1-mini">
              GPT Image 1 mini · {t('adminGenerated.fileForm.modelFaster')}
            </option>
          </select>
        </Field>
        <p className="self-end text-xs text-muted-foreground">
          {t('adminGenerated.fileForm.modelHelp')}
        </p>
      </div>

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
        className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md px-4 py-2 text-center text-sm font-semibold disabled:opacity-60 sm:w-auto ${
          previewLinked
            ? 'border border-destructive text-destructive hover:bg-destructive/10'
            : 'bg-primary text-primary-foreground'
        }`}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        {pending
          ? t('adminGenerated.fileForm.generating')
          : previewLinked
            ? t('adminGenerated.fileForm.regenerateBreak')
            : hasExistingFile
              ? t('adminGenerated.fileForm.regenerate')
              : t('adminGenerated.fileForm.generate')}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
