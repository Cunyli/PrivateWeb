# Admin MFA and public request protection

## Deployment prerequisites

Apply `security-hardening-20261030.sql` after the existing 20261028 security and public-budget migrations, then deploy the application. The migration has already been applied to the linked Supabase project. TOTP enrollment and verification were already enabled remotely; no unrelated Supabase defaults were pushed.

No new secret is required. Keep `ADMIN_EMAILS` (or the existing server-only `SUPABASE_ADMIN_EMAILS` fallback), Supabase service credentials and existing provider keys private. Vercel supplies `VERCEL=1` and its trusted `x-vercel-forwarded-for` client IP header. A different host must implement its own trusted IP/BotID integration before serving these public actions; the local development bypass is intended only for development.

The application uses BotID **Basic**, including explicit client and server `checkLevel: "basic"` options. Deep Analysis is not enabled. Vercel currently routes BotID automatically; no legacy rewrite wrapper is needed. See the [official setup](https://vercel.com/docs/botid/get-started) and [BotID plans](https://vercel.com/docs/botid).

## Administrator sign-in

The owner signs in at `/login` with the existing verified, allowlisted account. An existing TOTP factor prompts for its six-digit code. Otherwise, the owner explicitly clicks **Set up authenticator**, scans the QR code with their own authenticator and verifies a code. Enrollment is not performed automatically. Never share or commit the QR code, manual setup secret or one-time codes.

Password-only (AAL1) sessions can access only the authorization/MFA-status bootstrap endpoint, which returns the assurance level and no private records. All private API handlers require a server-verified AAL2 token. The `ai_tasks` table also has a restrictive AAL2 policy, in addition to its existing ownership rules, so direct browser Data API access cannot bypass this requirement.

If the authenticator is lost, the project owner must use the authenticated Supabase management recovery process, verify the affected account and remove only the lost factor before enrolling a replacement. Do not add a password-only bypass, make the account public or remove the restrictive task policy. This app does not provide recovery codes or a recovery backdoor.

## Public actions and data

BotID runs before booking persistence/email and before semantic embedding requests. Rejected bots return 403; verification or quota-storage failures return 503; exhausted quotas return 429 with `Retry-After`. Invalid or oversized booking bodies are rejected before any side effect; JSON bodies are capped at 16 KiB.

| Action | Per client | Shared budget |
| --- | --- | --- |
| Booking | 4 / 15 minutes, 12 / UTC day | 20 / hour, 60 / UTC day |
| Semantic search | 12 / minute, 120 / UTC day | 60 / minute, 2,000 / UTC day |

Windows are fixed database windows, not sliding windows. Client keys are HMAC-SHA256 digests of the trusted IP using the existing server secret; raw IPs are not added to the quota table. Different visitors on the same public IP share a quota. Rotating the service key also changes the client quota identifiers. Counter rows older than two days are removed on subsequent budget calls. Per-client rules run before global rules, so an already blocked visitor cannot spend the shared budget.

The missing `photo_session_bookings` table is created with RLS and service-role-only grants. No public/ordinary signed-in client can read or insert booking contact details. The existing server-side admin API remains the reader and requires AAL2. No real booking or email is sent by the verification scripts.

## Browser policy

All routes receive HSTS, `nosniff`, a strict referrer policy, disabled camera/microphone/geolocation permissions and frame protection. Private APIs use private/no-store caching.

HTML receives CSP with `object-src`, `base-uri`, `form-action`, `frame-ancestors`, event-handler restrictions and limited connection origins. Login/private pages are dynamically rendered with a fresh script nonce and `strict-dynamic`; production excludes `unsafe-eval`. Public pages preserve existing static caching and Next hydration by allowing inline script blocks. This public-page concession is not equivalent to a fully strict nonce/hash CSP. Inline styles remain permitted for the existing UI libraries. BotID challenge routes are excluded from the HTML middleware and allow same-origin frames.

## Verification

```bash
node scripts/check-supabase-security.cjs
node scripts/check-security-hardening.cjs
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm build
corepack pnpm audit
```

`security-hardening-20261030.verify.sql` tests client/global quota isolation, booking grants and AAL1/AAL2 task visibility inside a transaction that always rolls back. It does not send email, create a permanent task or retain synthetic counters. Run through the authenticated Supabase CLI with the explicit project reference and absolute SQL file path.

Browser checks must include ordinary public browsing, a normal semantic search through the UI on Vercel, the unauthenticated admin redirect and a nonce-protected login page without CSP errors. Direct requests without BotID proof should fail before expensive providers. Actual enrollment and OTP entry belong to the owner; fake-factor login tests cover the application flow without binding a real credential.

For an application rollback, the old one-argument budget RPC is retained, so the prior deployment can still run. Keep the booking table and its private grants. Reverting the AAL2 application enforcement would weaken protection; do not remove database policies or delete factors as a routine rollback. Database backups and service-provider recovery remain necessary; these checks are not a penetration-test certification.
