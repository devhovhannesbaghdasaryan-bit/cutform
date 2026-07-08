'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { actionError, actionSuccess, zodErrorToState, type ActionState } from '@/lib/action-state';
import { mergeSessionCartIntoUserCart } from '@/lib/cart';
import { clearCartSessionId, getCartSessionId } from '@/lib/cart-session';
import { getServerSupabase, getServiceSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';

export type AuthActionState = ActionState<null>;

const socialProviders = {
  facebook: 'facebook',
  google: 'google',
} as const;

const safeNextPath = z
  .string()
  .catch('/dashboard')
  .transform((value) => (value.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'));

const credentialsSchema = z.object({
  email: z
    .string()
    .catch('')
    .transform((value) => value.trim()),
  password: z.string().catch(''),
  next: safeNextPath,
});

const registerSchema = z.object({
  email: z.string().trim().min(1, 'Email and password are required.'),
  password: z
    .string()
    .min(1, 'Email and password are required.')
    .min(8, 'Password must be at least 8 characters.'),
});

const emailSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.'),
});

const otpSchema = emailSchema.extend({
  token: z
    .string()
    .transform((value) => value.replace(/\s+/g, ''))
    .refine((value) => /^\d{6}$/.test(value), 'Enter the 6-digit code from the email.'),
});

const socialSchema = z.object({
  provider: z.enum(['facebook', 'google']),
  next: safeNextPath,
});

function callbackUrl() {
  return `${getServerEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`;
}

async function mergeAnonymousCart(userId: string) {
  const sessionId = await getCartSessionId();
  if (!sessionId) return;
  await mergeSessionCartIntoUserCart(getServiceSupabase(), sessionId, userId);
  await clearCartSessionId();
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email') ?? '',
    password: formData.get('password') ?? '',
  });
  if (!parsed.success) return zodErrorToState(parsed.error);

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) return actionError(error.message);

  redirect(`/auth/verify-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const { email, password, next } = credentialsSchema.parse({
    email: formData.get('email') ?? '',
    password: formData.get('password') ?? '',
    next: formData.get('next') ?? '/dashboard',
  });

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return actionError(error.message);

  if (!data.user?.email_confirmed_at) redirect('/auth/verify-email');
  await mergeAnonymousCart(data.user.id);
  redirect(next);
}

export async function socialLoginAction(formData: FormData) {
  const next = safeNextPath.parse(formData.get('next') ?? '/dashboard');
  const parsed = socialSchema.safeParse({
    provider: formData.get('provider'),
    next: formData.get('next') ?? '/dashboard',
  });

  if (!parsed.success) {
    redirect(
      `/login?error=${encodeURIComponent('Unsupported login provider.')}&next=${encodeURIComponent(next)}`,
    );
  }

  const supabase = await getServerSupabase();
  const redirectTo = new URL(callbackUrl());
  redirectTo.searchParams.set('next', parsed.data.next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: socialProviders[parsed.data.provider],
    options: { redirectTo: redirectTo.toString() },
  });

  if (error || !data.url) {
    const message = error?.message ?? 'The login provider could not be started.';
    redirect(
      `/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(parsed.data.next)}`,
    );
  }

  redirect(data.url);
}

export async function logoutAction() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function resendVerificationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') ?? '' });
  if (!parsed.success) return zodErrorToState(parsed.error);

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) return actionError(error.message);
  return actionSuccess(null);
}

export async function verifyOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = otpSchema.safeParse({
    email: formData.get('email') ?? '',
    token: formData.get('token') ?? '',
  });
  if (!parsed.success) return zodErrorToState(parsed.error);

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: 'signup',
  });
  if (error) return actionError(error.message);

  if (data.user) await mergeAnonymousCart(data.user.id);
  redirect('/dashboard');
}
