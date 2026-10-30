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
- `TURNSTILE_SECRET_KEY`: Cloudflare Turnstile secret key.

The contact form requires a Turnstile widget/site key in the frontend before production use. Add the site key and render the widget in the contact form, then send its token as `turnstile_token`. Until the secrets and widget are configured, the API intentionally fails closed with HTTP 503.

## Important launch checks

- Confirm final business email and WhatsApp details.
- Configure Cloudflare Pages project and encrypted environment variables.
- Configure Turnstile site key and allowed hostnames.
- Test a real enquiry end-to-end and verify the database record.
- Add transactional email notification after selecting and configuring a provider.
- Review the privacy notice, retention period and final terms before public launch.
- Update the canonical domain and sitemap after the production hostname is confirmed.

Concept portfolio items are explicitly labelled and must not be presented as commissioned client work.
