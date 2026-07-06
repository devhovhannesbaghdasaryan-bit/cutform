'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignLeft,
  Bold,
  Check,
  ImagePlus,
  Italic,
  LoaderCircle,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  generatePersonalizedNightLightAction,
  type PersonalizedGenerationState,
} from '@/app/personalize/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERSONALIZED_NIGHT_LIGHT } from '@/lib/marketplace-constants';

const initialState: PersonalizedGenerationState = { code: 'idle', message: null };

export interface NightLightBoilerplateOption {
  id: string;
  name: string;
  imageUrl: string;
}

export function PersonalizedNightLightForm({
  modelId,
  boilerplates,
  copy,
}: {
  modelId: string;
  boilerplates: NightLightBoilerplateOption[];
  copy: Record<string, string>;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastValidHtml = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [html, setHtml] = useState('');
  const [fileName, setFileName] = useState('');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creditDialogDismissed, setCreditDialogDismissed] = useState(false);
  const [state, formAction, pending] = useActionState(
    generatePersonalizedNightLightAction,
    initialState,
  );
  const remaining = PERSONALIZED_NIGHT_LIGHT.maxTextLength - text.length;
  const selectedCount = selected.length;

  useEffect(
    () => () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    },
    [filePreview],
  );

  const selectedNames = boilerplates
    .filter((item) => selected.includes(item.id))
    .map((item) => item.name);

  function syncEditor() {
    const editor = editorRef.current;
    if (!editor) return;
    const nextText = (editor.innerText ?? '').replace(/\r/g, '');
    if (nextText.length > PERSONALIZED_NIGHT_LIGHT.maxTextLength) {
      editor.innerHTML = lastValidHtml.current;
      return;
    }
    lastValidHtml.current = editor.innerHTML;
    setText(nextText);
    setHtml(editor.innerHTML);
  }

  function format(command: 'bold' | 'italic' | 'justifyLeft' | 'justifyCenter') {
    editorRef.current?.focus();
    document.execCommand(command);
    syncEditor();
  }

  function toggleBoilerplate(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function updateFile(file?: File) {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFileName(file?.name ?? '');
    setFilePreview(file ? URL.createObjectURL(file) : null);
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        setCreditDialogDismissed(false);
        if (!selectedCount) event.preventDefault();
      }}
      className="space-y-6 rounded-xl border bg-card p-5 shadow-sm"
    >
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="customText" value={text} />
      <input type="hidden" name="customTextHtml" value={html} />

      <section className="space-y-3">
        <div>
          <Label>{copy.chooseTemplates}</Label>
          <p className="mt-1 text-sm text-muted-foreground">{copy.chooseTemplatesHelp}</p>
        </div>
        {boilerplates.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boilerplates.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className={`group relative cursor-pointer overflow-hidden rounded-lg border-2 transition focus-within:ring-2 focus-within:ring-ring ${checked ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40'}`}
                >
                  <input
                    type="checkbox"
                    name="boilerplateIds"
                    value={option.id}
                    checked={checked}
                    onChange={() => toggleBoilerplate(option.id)}
                    className="sr-only"
                  />
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    {/* Dynamic signed storage URLs are intentionally rendered without Next image optimization. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={option.imageUrl}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                    <span
                      className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border bg-background shadow ${checked ? 'border-primary bg-primary text-primary-foreground' : ''}`}
                    >
                      {checked ? <Check className="h-4 w-4" /> : null}
                    </span>
                  </div>
                  <span className="block p-3 text-sm font-medium">{option.name}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {copy.noTemplates}
          </div>
        )}
        {!selectedCount && boilerplates.length > 0 ? (
          <p className="text-sm text-muted-foreground">{copy.selectAtLeastOne}</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <Label htmlFor="images">{copy.image}</Label>
        <label className="relative flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-dashed bg-muted/30 p-5 text-center text-sm text-muted-foreground transition hover:bg-muted/50">
          {filePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={filePreview}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-25"
            />
          ) : null}
          <ImagePlus className="relative h-8 w-8" />
          <span className="relative font-medium text-foreground">{fileName || copy.upload}</span>
          <Input
            ref={fileInputRef}
            id="images"
            name="images"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="sr-only"
            onChange={(event) => updateFile(event.target.files?.[0])}
          />
          {fileName ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-2 h-8 w-8"
              aria-label="Remove image"
              onClick={(event) => {
                event.preventDefault();
                if (fileInputRef.current) fileInputRef.current.value = '';
                updateFile();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </label>
      </section>

      <section className="space-y-3">
        <Label htmlFor="ledColor">{copy.color}</Label>
        <div className="grid grid-cols-3 gap-2">
          {PERSONALIZED_NIGHT_LIGHT.comfortableLedColors.map((color) => (
            <label
              key={color.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="ledColor"
                value={color.value}
                defaultChecked={color.value === PERSONALIZED_NIGHT_LIGHT.defaultLedColor}
              />
              <span
                className="h-4 w-4 rounded-full border shadow-inner"
                style={{ backgroundColor: color.hex }}
              />
              {color.label}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="customTextEditor">
            {copy.text}{' '}
            <span className="font-normal text-muted-foreground">({copy.textOptional})</span>
          </Label>
          <span className="text-xs text-muted-foreground">
            {copy.charactersRemaining.replace('{count}', String(remaining))}
          </span>
        </div>
        <div className="overflow-hidden rounded-md border bg-background">
          <div className="flex gap-1 border-b bg-muted/40 p-1" aria-label="Text formatting">
            <EditorButton label="Bold" onClick={() => format('bold')}>
              <Bold className="h-4 w-4" />
            </EditorButton>
            <EditorButton label="Italic" onClick={() => format('italic')}>
              <Italic className="h-4 w-4" />
            </EditorButton>
            <EditorButton label="Align left" onClick={() => format('justifyLeft')}>
              <AlignLeft className="h-4 w-4" />
            </EditorButton>
            <EditorButton label="Align center" onClick={() => format('justifyCenter')}>
              <AlignCenter className="h-4 w-4" />
            </EditorButton>
          </div>
          <div className="relative">
            {!text ? (
              <span className="pointer-events-none absolute left-3 top-3 text-sm text-muted-foreground">
                {copy.textPlaceholder}
              </span>
            ) : null}
            <div
              ref={editorRef}
              id="customTextEditor"
              contentEditable
              role="textbox"
              aria-multiline="true"
              className="min-h-24 px-3 py-2 text-sm outline-none"
              onInput={syncEditor}
              onBlur={syncEditor}
              suppressContentEditableWarning
            />
          </div>
        </div>
      </section>

      {state.code === 'error' && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.message}
        </div>
      ) : null}

      <div className="sticky bottom-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{copy.creditPerStyle}</span>
          <strong>{copy.creditTotal.replace('{count}', String(selectedCount))}</strong>
        </div>
        <Button type="submit" className="w-full" disabled={pending || !selectedCount || !fileName}>
          {pending ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <WandSparkles className="mr-2 h-4 w-4" />
          )}
          {pending ? copy.generatingTitle : copy.generate.replace('{count}', String(selectedCount))}
        </Button>
        {selectedNames.length ? (
          <p className="mt-2 truncate text-center text-xs text-muted-foreground">
            {selectedNames.join(' · ')}
          </p>
        ) : null}
      </div>

      {pending ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-xl">
            <LoaderCircle className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 className="mt-5 text-xl font-semibold">{copy.generatingTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.generatingBody}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        </div>
      ) : null}

      {state.code === 'insufficient_credits' && !creditDialogDismissed && !pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="credits-dialog-title"
            className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl"
          >
            <h2 id="credits-dialog-title" className="text-xl font-semibold">
              {copy.notEnoughCredits}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-center text-sm">
              <div>
                <span className="block text-muted-foreground">{copy.requiredCredits}</span>
                <strong>{state.requiredCredits ?? selectedCount}</strong>
              </div>
              <div>
                <span className="block text-muted-foreground">{copy.availableCredits}</span>
                <strong>{state.availableCredits ?? '—'}</strong>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreditDialogDismissed(true)}
              >
                {copy.cancel}
              </Button>
              <Button asChild>
                <Link href="/credits">{copy.buyCredits}</Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function EditorButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
