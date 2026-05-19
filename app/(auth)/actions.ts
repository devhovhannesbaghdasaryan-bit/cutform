'use server';

import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';

export type AuthFormState = { error: string | null };

function callbackUrl() {
  return `${getServerEnv().NEXT_PUBLIC_SITE_URL}/auth/callback`;
}

export async function registerAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Email and password are required.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) return { error: error.message };

  redirect(`/auth/verify-email?email=${encodeURIComponent(email)}`);
}

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/dashboard');

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  if (!data.user?.email_confirmed_at) redirect('/auth/verify-email');
  redirect(next.startsWith('/') ? next : '/dashboard');
}

export async function logoutAction() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function resendVerificationAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return { error: 'Email is required.' };

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) return { error: error.message };
  return { error: null };
}

export async function verifyOtpAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim();
  const token = String(formData.get('token') ?? '').replace(/\s+/g, '');

  if (!email) return { error: 'Email is required.' };
  if (!/^\d{6}$/.test(token)) return { error: 'Enter the 6-digit code from the email.' };

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
  if (error) return { error: error.message };

  redirect('/dashboard');
}
