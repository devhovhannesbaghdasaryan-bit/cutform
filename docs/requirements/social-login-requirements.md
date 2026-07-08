# Social Login Requirements

Date: 2026-07-01

## Scope

Uniqraft must let a user authenticate with Facebook (Meta), Google, X, or Telegram from the existing login page while retaining email/password login.

Instagram is not a separate login identity in this scope: Meta authentication is provided through Facebook Login. Instagram API access, permissions, and account linking are separate product capabilities.

## Functional requirements

- Show a clearly labelled button for each provider before the email form.
- Use Supabase Auth and its server-side PKCE flow for every provider.
- Configure Facebook, Google, and X as built-in Supabase providers.
- Configure Telegram as the `custom:telegram` OIDC provider with issuer `https://oauth.telegram.org`, scopes `openid profile`, and email-optional identities.
- Return successful logins to the requested internal `next` route, defaulting to `/dashboard`.
- Reject external and protocol-relative `next` destinations to prevent open redirects.
- Display provider startup and callback errors on the login screen without exposing secrets.
- Merge the guest cart into the authenticated cart after any successful social login, then clear the guest cart cookie.
- Production rollout must test duplicate-email and provider-without-email behavior before launch.

## Security and operations

- Provider client secrets live only in Supabase/provider configuration, never in browser code or the repository.
- Provider callbacks use the Supabase callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`); the app callback remains `<site>/auth/callback`.
- Production and local app callback URLs must be allow-listed in Supabase Auth URL Configuration.
- Telegram requests only identity scopes by default; phone and bot messaging access require a separate product/privacy decision.
- Failed, cancelled, missing-code, and disabled-provider flows return safely to `/login`.

## Acceptance criteria

- Each button begins the expected provider authorization flow.
- A successful first login creates a Supabase user/session and lands at the safe `next` route.
- A returning login reuses the identity and does not create a duplicate profile.
- Login cancellation or failure produces an accessible error message.
- Guest cart contents survive login exactly once.
- Typecheck, lint, and production build pass.
