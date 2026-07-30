import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTransientSupabaseError, retryTransient } from '@/lib/supabase/retry';

describe('isTransientSupabaseError', () => {
  it('matches the transient allowlist case-insensitively', () => {
    expect(isTransientSupabaseError(new Error('JWT issued at future'))).toBe(true);
    expect(isTransientSupabaseError(new Error('jwt issued at future'))).toBe(true);
    expect(isTransientSupabaseError(new Error('TypeError: fetch failed'))).toBe(true);
    expect(isTransientSupabaseError(new Error('read ECONNRESET'))).toBe(true);
    expect(isTransientSupabaseError(new Error('socket hang up'))).toBe(true);
    expect(isTransientSupabaseError(new Error('connect ETIMEDOUT 1.2.3.4:443'))).toBe(true);
  });

  it('rejects non-transient errors and non-Error values', () => {
    expect(isTransientSupabaseError(new Error('permission denied for table carts'))).toBe(false);
    expect(isTransientSupabaseError(new Error('JWT expired'))).toBe(false);
    expect(isTransientSupabaseError(null)).toBe(false);
    expect(isTransientSupabaseError(undefined)).toBe(false);
  });
});

describe('retryTransient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin jitter to 0 (jitter = base * (random - 0.5)) so delays are exactly 250ms/500ms.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns immediately when fn succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(retryTransient(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient error and succeeds on a later attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('JWT issued at future'))
      .mockResolvedValue('ok');
    const result = retryTransient(fn);
    await vi.advanceTimersByTimeAsync(250);
    await expect(result).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-transient error without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permission denied for table carts'));
    await expect(retryTransient(fn)).rejects.toThrow('permission denied');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 attempts and rethrows the last error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('JWT issued at future'))
      .mockRejectedValueOnce(new Error('fetch failed'))
      .mockRejectedValue(new Error('socket hang up'));
    const result = retryTransient(fn);
    // Attach the rejection expectation before advancing timers to avoid
    // an unhandled rejection between ticks.
    const assertion = expect(result).rejects.toThrow('socket hang up');
    await vi.advanceTimersByTimeAsync(250 + 500);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('waits ~250ms then ~500ms between attempts', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('ok');
    const result = retryTransient(fn);
    const assertion = expect(result).resolves.toBe('ok');

    // Before first backoff elapses: only the initial attempt has run.
    await vi.advanceTimersByTimeAsync(249);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // t=250 → attempt 2
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(499);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // t=750 → attempt 3
    expect(fn).toHaveBeenCalledTimes(3);
    await assertion;
  });
});
