'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { createContext, useCallback, useContext, useState, useTransition } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { generateItemFieldValuesAction } from '@/app/admin/items/ai-fill-actions';
import { ITEM_AI_FIELD_KEYS } from '@/lib/item-ai';
import type { CategoryOption } from './types';

interface FieldError {
  field: string;
  message: string;
}

interface ItemFormAiContextValue {
  generateField: (field: string) => void;
  generateAll: () => void;
  pendingFields: ReadonlySet<string>;
  isFillAllPending: boolean;
  fieldError: FieldError | null;
  fillAllError: string | null;
  hasDescription: boolean;
  onDescriptionInput: (value: string) => void;
}

const ItemFormAiContext = createContext<ItemFormAiContextValue | null>(null);

function readFieldValue(form: HTMLFormElement, name: string): string {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
    ? element.value
    : '';
}

function writeFieldValue(form: HTMLFormElement, name: string, value: string) {
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = value;
  }
}

export function ItemFormAiProvider({
  formRef,
  categories,
  initialDescription,
  children,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  categories: CategoryOption[];
  initialDescription: string;
  children: React.ReactNode;
}) {
  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());
  const [isFillAllPending, setIsFillAllPending] = useState(false);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [fillAllError, setFillAllError] = useState<string | null>(null);
  const [hasDescription, setHasDescription] = useState(() => initialDescription.trim().length > 0);
  const [, startTransition] = useTransition();

  const onDescriptionInput = useCallback((value: string) => {
    setHasDescription(value.trim().length > 0);
  }, []);

  const run = useCallback(
    (fields: string[], isFillAll: boolean) => {
      const form = formRef.current;
      if (!form) return;

      const availableFields = fields.filter((field) => form.elements.namedItem(field) !== null);
      if (availableFields.length === 0) return;

      const sourceDescription = readFieldValue(form, 'description').trim();
      setFieldError(null);
      setFillAllError(null);

      if (!sourceDescription) {
        const message = 'Enter a description first.';
        if (isFillAll) setFillAllError(message);
        else setFieldError({ field: availableFields[0], message });
        return;
      }

      const categoryId = readFieldValue(form, 'categoryId');
      const categoryName = categories.find((category) => category.id === categoryId)?.name;

      setPendingFields(new Set(availableFields));
      setIsFillAllPending(isFillAll);

      startTransition(async () => {
        const result = await generateItemFieldValuesAction({
          sourceDescription,
          fields: availableFields,
          context: {
            title: readFieldValue(form, 'title').trim() || undefined,
            categoryName,
            itemType: readFieldValue(form, 'itemType').trim() || undefined,
          },
        });

        if ('error' in result) {
          if (isFillAll) setFillAllError(result.error);
          else setFieldError({ field: availableFields[0], message: result.error });
        } else {
          for (const [field, fieldValue] of Object.entries(result.values)) {
            writeFieldValue(form, field, fieldValue);
          }
        }
        setPendingFields(new Set());
        setIsFillAllPending(false);
      });
    },
    [formRef, categories],
  );

  const value: ItemFormAiContextValue = {
    generateField: (field) => run([field], false),
    generateAll: () => run([...ITEM_AI_FIELD_KEYS], true),
    pendingFields,
    isFillAllPending,
    fieldError,
    fillAllError,
    hasDescription,
    onDescriptionInput,
  };

  return <ItemFormAiContext.Provider value={value}>{children}</ItemFormAiContext.Provider>;
}

export function useItemFormAi() {
  const context = useContext(ItemFormAiContext);
  if (!context) {
    throw new Error('useItemFormAi must be used within an ItemFormAiProvider');
  }
  return context;
}

export function AutogenerateButton({ field }: { field: string }) {
  const { generateField, pendingFields, fieldError, hasDescription } = useItemFormAi();
  const isPending = pendingFields.has(field);
  const disabled = pendingFields.size > 0 || !hasDescription;

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        title={hasDescription ? undefined : 'Enter a description first.'}
        onClick={() => generateField(field)}
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-3.5" aria-hidden="true" />
        )}
        Autogenerate
      </Button>
      {fieldError?.field === field ? (
        <span role="alert" className="text-xs text-destructive">
          {fieldError.message}
        </span>
      ) : null}
    </span>
  );
}

export function FillAllButton() {
  const { generateAll, pendingFields, isFillAllPending, fillAllError, hasDescription } =
    useItemFormAi();
  const disabled = pendingFields.size > 0 || !hasDescription;

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        title={hasDescription ? undefined : 'Enter a description first.'}
        onClick={generateAll}
      >
        {isFillAllPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        Fill all fields from description
      </Button>
      {fillAllError ? (
        <span role="alert" className="text-xs text-destructive">
          {fillAllError}
        </span>
      ) : null}
    </div>
  );
}
