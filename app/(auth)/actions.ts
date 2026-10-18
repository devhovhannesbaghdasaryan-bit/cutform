'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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

type AuthTranslator = Awaited<ReturnType<typeof getTranslations<'auth'>>>;

function registerSchema(t: AuthTranslator) {
  return z.object({
    email: z.string().trim().min(1, t('errorEmailPasswordRequired')),
    password: z.string().min(1, t('errorEmailPasswordRequired')).min(8, t('errorPasswordLength')),
  });
}

function emailSchema(t: AuthTranslator) {
  return z.object({
    email: z.string().trim().min(1, t('errorEmailRequired')),
  });
}

function otpSchema(t: AuthTranslator) {
  return emailSchema(t).extend({
    token: z
      .string()
      .transform((value) => value.replace(/\s+/g, ''))
      // Supabase's email OTP length is a project setting (6–10 digits).
      .refine((value) => /^\d{6,10}$/.test(value), t('errorCode')),
  });
}

/**
 * Localizes the common Supabase auth failures by their stable error code;
 * anything unrecognized falls through to the provider's own message.
 */
function authErrorMessage(t: AuthTranslator, error: { code?: string; message: string }) {
  switch (error.code) {
    case 'invalid_credentials':
      return t('errorInvalidCredentials');
    case 'user_already_exists':
    case 'email_exists':
      return t('errorUserExists');
    case 'weak_password':
      return t('errorWeakPassword');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return t('errorRateLimit');
    case 'otp_expired':
      return t('errorCodeExpired');
    default:
      return error.message;
  }
}

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
  const t = await getTranslations('auth');
  const parsed = registerSchema(t).safeParse({
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
  if (error) return actionError(authErrorMessage(t, error));

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
  if (error) return actionError(authErrorMessage(await getTranslations('auth'), error));

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
    redirect(`/login?error=unsupported_provider&next=${encodeURIComponent(next)}`);
  }

  const supabase = await getServerSupabase();
  const redirectTo = new URL(callbackUrl());
  redirectTo.searchParams.set('next', parsed.data.next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: socialProviders[parsed.data.provider],
    options: { redirectTo: redirectTo.toString() },
  });

  if (error || !data.url) {
    // Coded errors are localized by the login page; provider messages pass through.
    const message = error?.message ?? 'provider_unavailable';
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
  const t = await getTranslations('auth');
  const parsed = emailSchema(t).safeParse({ email: formData.get('email') ?? '' });
  if (!parsed.success) return zodErrorToState(parsed.error);

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) return actionError(authErrorMessage(t, error));
  return actionSuccess(null);
}

export async function verifyOtpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const t = await getTranslations('auth');
  const parsed = otpSchema(t).safeParse({
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
  if (error) return actionError(authErrorMessage(t, error));

  if (data.user) await mergeAnonymousCart(data.user.id);
  redirect('/dashboard');
}
