# Social Login Implementation Tasks

Date: 2026-07-01

> **Updated (2026-07-08):** Scope reduced to Facebook and Google only. X and Telegram were never configured as Supabase providers and are no longer planned.

## Application — completed

- [x] Add Facebook and Google login actions using Supabase PKCE.
- [x] Add accessible provider buttons while retaining email/password login.
- [x] Preserve and validate the post-login `next` destination.
- [x] Surface OAuth startup and callback errors on the login page.
- [x] Merge the guest cart after OAuth callback.
- [x] Document requirements, security constraints, and acceptance criteria.

## Provider configuration — deployment owner

- [ ] Create web OAuth applications in Google Cloud Console and Meta for Developers.
- [ ] Register the Supabase Auth callback URL with each provider.
- [ ] Enable the Facebook and Google providers in Supabase and add their client credentials.
- [ ] Allow-list local, preview, and production `/auth/callback` URLs in Supabase.
- [ ] Complete provider branding, consent-screen, and privacy-policy requirements.

## Launch verification — deployment owner

- [ ] Test first-time and returning login for every provider in a production-like preview.
- [ ] Test cancellation, disabled provider, bad callback, and missing-email cases.
- [ ] Verify duplicate-email and account-linking behavior against product policy.
- [ ] Verify `next` routing and guest-cart merge for both providers.
- [ ] Confirm provider secrets are absent from client bundles, logs, and source control.
