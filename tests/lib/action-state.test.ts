import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  actionError,
  actionSuccess,
  errorOf,
  idleState,
  zodErrorToState,
} from '@/lib/action-state';

describe('action state helpers', () => {
  it('builds success and error states', () => {
    expect(actionSuccess(null)).toEqual({ status: 'success', data: null });
    expect(actionSuccess({ id: 1 }, 'Saved.')).toEqual({
      status: 'success',
      data: { id: 1 },
      message: 'Saved.',
    });
    expect(actionError('Nope.')).toEqual({ status: 'error', error: 'Nope.' });
  });

  it('extracts the error only from error states', () => {
    expect(errorOf(idleState)).toBeNull();
    expect(errorOf(actionSuccess(null))).toBeNull();
    expect(errorOf(actionError('Broken.'))).toBe('Broken.');
  });

  it('maps zod errors to the first message plus field errors', () => {
    const schema = z.object({
      email: z.string().min(1, 'Email is required.'),
      password: z.string().min(8, 'Password must be at least 8 characters.'),
    });
    const result = schema.safeParse({ email: '', password: 'short' });
    expect(result.success).toBe(false);
    if (result.success) return;

    const state = zodErrorToState(result.error);
    expect(state).toMatchObject({ status: 'error', error: 'Email is required.' });
    if (state.status !== 'error') return;
    expect(state.fieldErrors).toEqual({
      email: ['Email is required.'],
      password: ['Password must be at least 8 characters.'],
    });
  });
});
