// Simulate the real app signup path: supabase-js sends emailRedirectTo
// correctly as a redirect_to query param so the email template wires it up.
import { createClient } from '@supabase/supabase-js';

const url = 'http://127.0.0.1:54321';
const anon =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const email = `smoke-${Date.now()}@example.com`;
const password = 'correct-horse-battery-staple';

const supabase = createClient(url, anon);
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: 'http://localhost:3000/auth/callback' },
});
console.log(JSON.stringify({ email, error: error?.message, userId: data?.user?.id }, null, 2));
