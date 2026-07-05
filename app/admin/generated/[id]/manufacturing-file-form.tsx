'use client';

import { Loader2, Sparkles } from 'lucide-react';
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
}

const initialState: ManufacturingFileGenerationState = { status: 'idle', message: null };

export function ManufacturingFileForm({
  generatedItemId,
  optionId,
  optionName,
  defaultPrompt,
  hasExistingFile,
}: ManufacturingFileFormProps) {
  const [state, action, pending] = useActionState(generateManufacturingFileAction, initialState);
  const fieldPrefix = `manufacturing-file-${optionId}`;

  return (
    <form action={action} className="min-w-0 space-y-4 rounded-lg border border-dashed bg-muted/20 p-3 sm:p-4">
      <input type="hidden" name="generatedItemId" value={generatedItemId} />
      <input type="hidden" name="optionId" value={optionId} />
      <div>
        <p className="font-medium">Manufacturing PNG generator</p>
        <p className="text-sm text-muted-foreground">
          Admin-only production step for {optionName}. The customer preview flow does not generate this file.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor={`${fieldPrefix}-prompt`} className="text-sm font-medium">Prompt</label>
        <textarea
          id={`${fieldPrefix}-prompt`}
          name="prompt"
          defaultValue={defaultPrompt}
          rows={12}
          required
          className="min-h-64 w-full min-w-0 max-w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
        />
        <p className="text-xs text-muted-foreground">Prefilled from the customer request and this option’s manufacturing settings. Edit before generating.</p>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2">
        <Field label="Model" htmlFor={`${fieldPrefix}-model`}>
          <select id={`${fieldPrefix}-model`} name="model" defaultValue="gpt-image-2" className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
            <option value="gpt-image-2">GPT Image 2 · best quality</option>
            <option value="gpt-image-1.5">GPT Image 1.5 · balanced</option>
            <option value="gpt-image-1">GPT Image 1 · previous generation</option>
            <option value="gpt-image-1-mini">GPT Image 1 mini · faster</option>
          </select>
        </Field>
        <p className="self-end text-xs text-muted-foreground">The selected OpenAI image model edits the original source image at high fidelity and returns the production PNG directly.</p>
      </div>

      {state.message ? (
        <p role="status" className={`text-sm ${state.status === 'error' ? 'text-destructive' : 'text-success'}`}>
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground disabled:opacity-60 sm:w-auto"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
        {pending ? 'Generating production PNG…' : hasExistingFile ? 'Regenerate manufacturing PNG' : 'Generate manufacturing PNG'}
      </button>
    </form>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
