import type { z } from 'zod';

/**
 * Shared result type for server actions consumed by `useActionState`.
 *
 * Convention: form-rendering actions return `ActionState<T>`. Imperative flows
 * that end in `redirect()` (checkout, cart, credits) also return `ActionState`
 * for *validation* failures so the form can show them — `redirect()` throws, so
 * the success path composes with `useActionState` unchanged. Only genuine
 * infrastructure errors (database, payment provider) keep throwing.
 */
export type ActionState<T = null> =
  | { status: 'idle' }
  | { status: 'success'; data: T; message?: string }
  | {
      status: 'error';
      error: string;
      fieldErrors?: Record<string, string[]>;
      /**
       * Submitted values to re-populate the form with. React resets a form once
       * its action settles, so a form that wants to keep the buyer's input on a
       * validation error echoes it back here and feeds it to `defaultValue`.
       */
      values?: Record<string, string>;
    };

export const idleState: ActionState<never> = { status: 'idle' };

export function actionSuccess<T>(data: T, message?: string): ActionState<T> {
  return message === undefined ? { status: 'success', data } : { status: 'success', data, message };
}

export function actionError(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionState<never> {
  return fieldErrors === undefined
    ? { status: 'error', error }
    : { status: 'error', error, fieldErrors };
}

export function zodErrorToState(error: z.ZodError): ActionState<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    fieldErrors[key] ??= [];
    fieldErrors[key].push(issue.message);
  }
  return actionError(error.issues[0]?.message ?? 'Invalid input.', fieldErrors);
}

/** Convenience for narrowing in components: `errorOf(state)` renders or hides. */
export function errorOf(state: ActionState<unknown>): string | null {
  return state.status === 'error' ? state.error : null;
}
