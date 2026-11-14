# Noctra Hours Administration Platform — Operator Setup

This document describes the server-side configuration required to activate the Noctra Hours administration portal. Never commit credentials to GitHub or place privileged values in Vite-prefixed variables.

## Current architecture

- Identity: the existing Supabase Auth project.
- Administrative membership and permissions: `admin_members`, `admin_roles`, `admin_permissions`, `admin_role_permissions`.
- CMS: `admin_content` with typed resource categories and JSONB content payloads.
- Settings: `admin_site_settings`.
- Media: `admin_media_assets` and the `noctra-media` storage bucket.
- Revisions: `admin_content_revisions` with numbered snapshots and restore support.
- Publication history: append-only `admin_publication_history`.
- Audit: append-only `admin_audit_logs`.
- Enquiries: the existing `project_enquiries` table; no duplicate lead database is created.
- Redirects: `admin_redirects` applied by Pages middleware.
- Server API: Cloudflare Pages Function at `/api/admin`.
- Public CMS feed: `/api/public-content`, returning only published and explicitly approved public fields.
- Browser code never receives the Supabase service-role key.

## Database migrations

The following migrations have been applied to the connected Noctra Hours Supabase project:

1. `20261114125659_admin_studio_platform.sql` — admin roles/permissions, CMS tables, revisions, settings, media metadata, audit log, enquiry notes and initial industries.
2. `20261114130009_extend_noctra_admin_foundation.sql` — publication history, redirects, revision numbering, additional permissions and supporting columns.
3. `20261114130131_extend_noctra_admin_foundation.sql` — idempotent duplicate entry present in the remote migration history; retained to keep repository and remote migration history aligned.
4. `20261114130347_seed_initial_services_and_ventures.sql` — initial service taxonomy and ecosystem venture entries.
5. `20261114132010_seed_initial_capabilities_and_navigation.sql` — initial capabilities index and public navigation.

The migrations preserve the existing enquiry records and existing enquiry status values. New administration statuses are added without dropping historical values.

## Cloudflare Pages environment

Configure these variables for **both Production and Preview** in the Cloudflare Pages project settings.

| Variable | Type | Purpose |
|---|---|---|
| \`SUPABASE_URL\` | Plain text | Existing Supabase project URL |
| \`SUPABASE_ANON_KEY\` or \`SUPABASE_PUBLISHABLE_KEY\` | Plain text | Supabase Auth password and refresh requests |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Secret | Server-only database and Auth Admin API access |
| \`ADMIN_SESSION_SECRET\` | Secret | At least 32 random characters; AES-GCM session-cookie encryption |
| \`ADMIN_BOOTSTRAP_EMAIL\` | Plain text | Exact email allowed to create the first Super Administrator |
| \`ADMIN_BOOTSTRAP_SECRET\` | Secret | At least 32 random characters; one-time initial setup gate |

The existing public enquiry endpoint also depends on its server-side variables, including Turnstile, Resend, origin validation and rate-limit settings. Preserve those settings.

Never use a \`VITE_\` prefix for secrets.

### Current configuration blockers

At the time of implementation review, the Cloudflare Pages project did not expose the following required administration variables as configured: \`SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`, \`ADMIN_SESSION_SECRET\`, \`ADMIN_BOOTSTRAP_EMAIL\` and \`ADMIN_BOOTSTRAP_SECRET\`.

The Supabase service-role key cannot be recovered from the public project settings. The project owner must add it as an encrypted Cloudflare Pages secret. Do not paste it into chat or source files.

The initial administrator email must be supplied by the project owner. The bootstrap secret and session secret should be generated with a password manager or a cryptographically secure generator and stored only in Cloudflare.

## First administrator setup

1. Restore the Noctra Hours Supabase project if it is paused.
2. Configure the six environment variables above in Cloudflare Pages Production.
3. Configure the same variables in Preview if the first setup will be tested on a preview deployment. Use a different bootstrap secret in Preview if desired.
4. Ensure Supabase Auth email/password sign-in and SMTP email delivery are enabled.
5. Add \`https://noctra-hours.pages.dev/admin/reset-password\` to Supabase Auth → URL Configuration → Redirect URLs. Add the exact preview hostname used for testing as well.
6. Open \`/admin\`.
7. The first-time setup screen accepts only the exact configured bootstrap email and one-time bootstrap secret. Choose a strong administrator password. The server creates the Supabase Auth identity and attaches the existing \`super_administrator\` role.
8. Once the first membership exists, bootstrap is permanently closed by a server-side membership check.
9. Remove \`ADMIN_BOOTSTRAP_SECRET\` from Cloudflare after successful setup. Keep the session encryption secret.

Do not share the service-role key, session secret or bootstrap secret in chat, source files, screenshots, commits or logs.

## Implemented administration modules

- Dashboard with genuine CMS, enquiry and activity counts.
- Industries, services, capabilities, projects, ventures, testimonials, pages and navigation CMS.
- Draft, review, approved, published and archived workflow.
- Numbered content revision history and restore.
- Website settings for identity, homepage visibility, navigation, footer, contact, social links, business profile, brand tokens, SEO defaults and maintenance mode.
- Media upload, metadata editing and reference-safe deletion.
- Enquiry status updates, internal notes and follow-up fields.
- Administrator invitations, role changes, suspension, custom permission roles and password recovery.
- Audit history and publication history.
- SEO redirect creation and enable/disable controls.
- Integration configuration presence and live connectivity checks.
- Public rendering of published CMS content for industries, services, capabilities, ventures, projects, verified testimonials, navigation and custom pages.
- Dynamic sitemap entries for published CMS pages.

## Security model

- All privileged data operations run in Pages Functions using the service-role key.
- Administrative tables have RLS enabled and direct public/authenticated table grants revoked.
- Each request validates the Supabase Auth session, reloads the active membership and checks database-backed permission keys.
- Session tokens are encrypted in Secure, HttpOnly, SameSite cookies.
- Login and bootstrap attempts use the existing private database rate-limit RPC.
- Audit and publication history are append-only.
- Published testimonials are exposed only when both verification and approval statuses are explicitly set.
- Media deletion checks references from published content.
- Integration screens show configuration status only; they never reveal secret values.

## Remaining production verification

The implementation is not considered production-ready until the owner configures the required Cloudflare secrets and the following checks pass:

- First Super Administrator bootstrap and subsequent login.
- Role/permission tests, including direct API and RLS denial tests.
- Media upload and safe deletion against the live bucket.
- CMS draft, approval, publish, unpublish and restore against the public site.
- Enquiry notes and status changes against real test records.
- Redirect behaviour on the deployed Pages runtime.
- Desktop, tablet and Android visual inspection.
- Email/Turnstile integration checks.
- Production logs and error review.

Scheduled publishing, MFA enrollment UX, full section drag-and-drop ordering and external integration credential rotation are not represented as complete.
