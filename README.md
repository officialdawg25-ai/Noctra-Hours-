# NOCTRA HOURS

Independent Digital Development Studio.

A React + Vite marketing website for Noctra Hours, serving Giyani, Limpopo and businesses across South Africa.

## Local development

- Install dependencies: \`npm install\`
- Run the frontend: \`npm run dev\`
- Run automated tests: \`npm test\`
- Build for production: \`npm run build\`

For local Pages Functions development, copy \`.dev.vars.example\` to \`.dev.vars\`, fill in test credentials and use \`npx wrangler pages dev dist\`. Never commit \`.dev.vars\` or real credentials.

## Deployment

Cloudflare Pages is connected to this GitHub repository.

- Production branch: \`main\`
- Build command: \`npm install && npm test && npm run build\`
- Build output: \`dist\`
- Functions directory: \`functions/\`

Pages Functions provide public runtime configuration, a dynamic sitemap and robots file, and the secure project-enquiry endpoint.

## Cloudflare Pages environment configuration

Set variables under **Workers & Pages → noctra-hours → Settings → Variables and Secrets → Production**. Use the encrypted **Secret** type for credentials. Do not commit real credentials or place them in frontend code.

### Public / non-secret variables

| Variable | Purpose |
| --- | --- |
| \`PUBLIC_SITE_URL\` | Canonical HTTPS origin. Currently \`https://noctra-hours.pages.dev\`; replace when a custom domain is connected. |
| \`ALLOWED_ORIGIN\` | Exact allowed origin for enquiry POST requests. Currently \`https://noctra-hours.pages.dev\`. |
| \`CONTACT_EMAIL\` | Public business contact email. Leave blank until supplied. |
| \`WHATSAPP_NUMBER\` | WhatsApp number in international digits, including country code, without spaces or plus sign. |
| \`SOCIAL_INSTAGRAM_URL\` | Optional HTTPS Instagram profile URL. |
| \`SOCIAL_LINKEDIN_URL\` | Optional HTTPS LinkedIn profile URL. |
| \`SOCIAL_FACEBOOK_URL\` | Optional HTTPS Facebook page URL. |
| \`SUPABASE_URL\` | Noctra Hours Supabase project URL. |
| \`TURNSTILE_SITE_KEY\` | Public Cloudflare Turnstile site key. |
| \`TURNSTILE_ALLOWED_HOSTNAMES\` | Comma-separated exact hostnames accepted in successful Turnstile responses. |
| \`NOTIFICATION_EMAIL\` | Destination inbox for new enquiries. |
| \`FROM_EMAIL\` | Verified sender address from the transactional email provider. |

### Encrypted secrets

| Secret | Purpose |
| --- | --- |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Server-only Supabase service-role key. Never expose it to the browser. |
| \`TURNSTILE_SECRET_KEY\` | Cloudflare Turnstile server-side verification secret. |
| \`RATE_LIMIT_HASH_SECRET\` | Random secret of at least 32 characters used to hash client IPs before rate-limit storage. |
| \`RESEND_API_KEY\` | Resend transactional email API key. |

Generate a strong rate-limit secret with a password manager or a local cryptographically secure generator. Do not paste it into source files or public chat.

### Turnstile

A managed Turnstile widget has been created for the current Pages hostname, \`noctra-hours.pages.dev\`. Its public site key is configured in the production Pages environment. Its secret is stored as an encrypted Pages secret. The hostname must be updated if a custom domain becomes the production hostname.

### Supabase

Project ref: \`pcdwnspmeuihliergiei\`.

The \`project_enquiries\` table uses RLS and has no public insert/read policies. The Pages Function writes with the server-side service-role key. The \`enquiry_rate_limits\` table also has RLS enabled and no public policies. The \`consume_enquiry_rate_limit\` RPC is executable only by \`service_role\`; it enforces five requests per IP hash per 60-second window. Raw IP addresses are not stored in the rate-limit table.

Migration: \`supabase/migrations/20261031042002_add_private_enquiry_rate_limiting.sql\`.

### Email and contact details

Create a Resend account, verify a sender domain you control, create an API key, then configure \`RESEND_API_KEY\`, \`FROM_EMAIL\`, and \`NOTIFICATION_EMAIL\`. The function sends an internal notification and a customer acknowledgement. The form stays disabled until the complete required configuration is present.

Public email and WhatsApp details are read from \`CONTACT_EMAIL\` and \`WHATSAPP_NUMBER\`; neither is hardcoded in the React application. Social links are optional and appear only when valid HTTPS URLs are configured.

## Security behaviour

- Enquiries fail closed until all required environment variables are present.
- Same-origin requests are enforced through \`ALLOWED_ORIGIN\`.
- Turnstile tokens are verified server-side, including returned hostname validation.
- A honeypot, request-size limit, server-side field validation and duplicate fingerprint are applied.
- Rate limiting uses a private Supabase RPC instead of an unsupported Wrangler binding.
- Service-role, Turnstile and Resend credentials are never returned by \`/api/site-config\`.
- Email delivery failures are logged without logging submitted personal information.
- The \`_headers\` file sets baseline security headers and a restrictive Content Security Policy.
- The public site configuration endpoint returns only public contact values and the Turnstile site key.

## Operator launch checklist

1. Add \`SUPABASE_SERVICE_ROLE_KEY\` as an encrypted Cloudflare Pages secret.
2. Add \`RATE_LIMIT_HASH_SECRET\` as an encrypted secret (minimum 32 characters).
3. Create a Resend account, verify a sender domain, and add \`RESEND_API_KEY\`, \`FROM_EMAIL\`, and \`NOTIFICATION_EMAIL\`.
4. Add \`CONTACT_EMAIL\` and \`WHATSAPP_NUMBER\`; add social profile URLs if desired.
5. Confirm \`PUBLIC_SITE_URL\` and \`ALLOWED_ORIGIN\` match the final HTTPS hostname.
6. Submit an authorised live test enquiry and verify the database row, internal email and customer acknowledgement.
7. Review the privacy notice, retention schedule and commercial terms with appropriate South African professional advice before public launch.

No customer contact details, testimonials, client commissions, certifications, awards or performance statistics are invented. Portfolio concept studies are explicitly labelled as concepts.
