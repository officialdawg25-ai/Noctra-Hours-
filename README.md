# NOCTRA HOURS

Independent Digital Development Studio.

A React + Vite marketing website for Noctra Hours, serving Giyani, Limpopo and businesses across South Africa.

## Development

- Install: `npm install`
- Run locally: `npm run dev`
- Production build: `npm run build`

## Deployment

Designed for Cloudflare Pages:
- Build command: `npm run build`
- Build output: `dist`
- Functions directory: `functions/`

## Enquiry function environment bindings

Configure these as encrypted Cloudflare Pages environment variables before enabling live enquiries:

- `SUPABASE_URL`: the Noctra Hours Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service-role key. Never expose it in browser code.
- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret key.\n- `ENQUIRY_RATE_LIMIT`: Cloudflare Workers Rate Limiting binding, keyed by client IP.\n- `RESEND_API_KEY`, `NOTIFICATION_EMAIL`, `FROM_EMAIL`: optional Resend email delivery settings for internal alerts and client acknowledgements.

The contact form requires build-time `VITE_TURNSTILE_SITE_KEY`, the encrypted `TURNSTILE_SECRET_KEY`, a rate-limit binding and the Supabase service-role secret. The API intentionally fails closed until all mandatory controls are configured. Email delivery is optional but must be configured and tested before the site promises acknowledgements or internal notifications.

## Important launch checks

- Confirm final business email and WhatsApp details.
- Configure Cloudflare Pages project and encrypted environment variables.
- Configure Turnstile site key and allowed hostnames.
- Test a real enquiry end-to-end and verify the database record.
- Verify Resend notification and acknowledgement delivery after configuring the sender domain and credentials.
- Review the privacy notice, retention period and final terms before public launch.
- Update the canonical domain and sitemap after the production hostname is confirmed.

Concept portfolio items are explicitly labelled and must not be presented as commissioned client work.
