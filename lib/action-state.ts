import type { z } from 'zod';

/**
 * Shared result type for server actions consumed by `useActionState`.
 *
 * Convention: form-rendering actions return `ActionState<T>`; imperative
 * flows that end in `redirect()` (checkout, cart, credits) keep throwing
 * instead — converting those would change their UX.
 */
export type ActionState<T = null> =
  | { status: 'idle' }
  | { status: 'success'; data: T; message?: string }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string[]> };

export const idleState: ActionState<never> = { status: 'idle' };

export function actionSuccess<T>(data: T, message?: string): ActionState<T> {
  return message === undefined
    ? { status: 'success', data }
    : { status: 'success', data, message };
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
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return actionError(error.issues[0]?.message ?? 'Invalid input.', fieldErrors);
}

/** Convenience for narrowing in components: `errorOf(state)` renders or hides. */
export function errorOf(state: ActionState<unknown>): string | null {
  return state.status === 'error' ? state.error : null;
}
