# Noctra Hours Administration Platform — Operator Setup

This document describes the server-side configuration required to activate the administrative portal. Do not commit credentials to GitHub or place privileged values in Vite-prefixed variables.

## Current architecture

- Identity: Supabase Auth.
- Administrative membership and roles: existing `admin_members`, `admin_roles`, `admin_permissions`, and `admin_role_permissions`.
- CMS records: existing `admin_content` with JSONB content payloads.
- Settings: existing `admin_site_settings`.
- Media metadata: existing `admin_media_assets`; public asset bucket: `noctra-media`.
- Revisions and audit: existing `admin_content_revisions` and `admin_audit_logs`, extended by migration `20261114130000`.
- Server API: Cloudflare Pages Function at `/api/admin`.
- Public CMS feed: `/api/public-content`, which returns only records whose status is `published`.
- Browser code never receives the Supabase service-role key.

## Cloudflare Pages environment

Configure the following for **both Production and Preview** in the Cloudflare Pages project settings.

| Variable | Type | Purpose |
|---|---|---|
| `SUPABASE_URL` | Plain text | Existing Supabase project URL |
| `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` | Plain text | Supabase Auth password and refresh requests |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Server-only database and Auth Admin API access |
| `ADMIN_SESSION_SECRET` | Secret | At least 32 random characters; AES-GCM session-cookie encryption |
| `ADMIN_BOOTSTRAP_EMAIL` | Plain text | Exact email allowed to create the first super administrator |
| `ADMIN_BOOTSTRAP_SECRET` | Secret | At least 32 random characters; one-time first-admin setup gate |

Never use a `VITE_` prefix for any secret.

The existing public enquiry endpoint also depends on its previously documented server-side variables, including Turnstile, Resend, origin validation and rate-limit settings. Preserve those settings when configuring the project.

## First administrator setup

1. Add all six variables above to the Cloudflare Pages Production environment.
2. Add the same values to Preview if the first setup will be tested on a preview deployment. Use a separate bootstrap secret for Preview if preferred.
3. Ensure Supabase Auth email/password sign-in is enabled.
4. Ensure the Supabase Auth email provider is configured before inviting additional administrators.
5. Open `/admin`.
6. The first-time setup screen accepts only the exact `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_SECRET`.
7. Choose a strong password of at least 12 characters. The server creates the Supabase Auth identity and attaches the existing `super_administrator` role.
8. After the first membership exists, bootstrap is permanently closed by the server-side membership check. Remove `ADMIN_BOOTSTRAP_SECRET` from Cloudflare after successful setup.

Do not share the service-role key or bootstrap secret in chat, source files, screenshots, commits or logs.

## Security model

- All admin data operations run in Pages Functions using the service-role key.
- Administrative tables have RLS enabled and no browser-role policies; direct `anon` and `authenticated` table grants are revoked.
- Each request validates the Supabase Auth session, reloads the active admin membership and checks the role's permission keys server-side.
- Session tokens are encrypted in a Secure, HttpOnly, SameSite=Lax cookie scoped to `/api/admin`.
- Login and bootstrap attempts use the existing private database rate-limit RPC.
- Audit and publication history are append-only for the server role.
- Public CMS responses include only published content fields.

## Current implementation boundaries

The current portal foundation supports authentication bootstrap/login/logout, permission-aware dashboard reads, draft content CRUD, submit/review/approve/publish/unpublish/archive workflow, responsive record preview, content revision history and restore, settings, enquiry status and notes, redirects, audit reads, administrator invitations, role changes and suspension, plus raster-image upload, metadata editing and reference-safe deletion.

The public homepage currently consumes published CMS entries for Industries, Services and Companies & Ventures, while preserving the existing static presentation as a fallback.

Media upload/reference-safe deletion, full user/session administration, MFA/password recovery UX, comprehensive page/section and SEO controls, full public rendering of every CMS resource, preview/version restoration, integration health, and end-to-end security/browser testing remain separate implementation work. Do not treat the portal as production-ready until those are implemented and verified.
