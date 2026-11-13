# KINTSUGI — Financial Recovery Guidance

**When money feels uncertain, start with what happened.**

Kintsugi is an independent financial-recovery guidance demonstration for people facing suspected scams or payment hardship. It is designed to reduce pressure, avoid collecting sensitive information, and direct people to their actual bank for urgent account protection.

## Public demo

- Guided-choice fraud and hardship flows; no free-text chat field.
- No login, payment form, file upload, document upload, or public case submission.
- Choices remain in browser memory only; the static demo does not transmit or persist them.
- Clear warnings against OTP/PIN/password harvesting, recovery fees, remote access, and “safe account” scams.
- A copyable customer-prepared summary; nothing is submitted to a bank.

## Repository map

- `index.html`, `assets/styles.css`, `assets/app.js` — responsive, accessible, safety-first public demo.
- `_headers` — Cloudflare Pages security headers and restrictive Content Security Policy.
- `SECURITY.md` — security posture, threat model, residual risks, and launch requirements.
- `worker/src/index.ts` — Cloudflare Worker API with Cloudflare Access JWT validation, bounded request bodies, rate limiting, server-side eGain adapter, and tenant-scoped case routes.
- `worker/migrations/0001_initial.sql` — PostgreSQL case schema and RLS policies.
- `knowledge-base/` — eight fictional demonstration policy documents.
- `egain/CONNECTOR_SETUP.md` — eGain setup instructions and credential boundary.
- `egain/FEATURES.md` — eGain agent/workflow requirements and integration status.
- `docs/EDGE_ABUSE_CONTROLS.md` — Cloudflare WAF and abuse-control checklist.
- `docs/CLOUDFLARE_DEPLOYMENT.md` — deployment and database setup.
- `tests/TEST_MATRIX.md` — workflow, security, and tenant-isolation test cases.

## Security status — read before deployment

Kintsugi is not scam-proof and is not a bank, regulator, police service, or payment provider. It never blocks cards, reverses transfers, files real disputes, or guarantees recovery.

The public page is static and has no public write endpoint. Worker APIs require Cloudflare Access. PostgreSQL RLS is included, but production security depends on correctly provisioning a non-owner, non-superuser runtime role without BYPASSRLS and testing pooled-connection tenant isolation.

Cloudflare WAF, bot controls, DNSSEC, registrar lock, Hyperdrive, Access policies, and the production domain must still be configured in the account. See `SECURITY.md`.

## eGain status

A **server-side read-only eGain Answers API adapter** is implemented at `POST /api/knowledge/answer`. It uses OAuth 2.0 client credentials and keeps tokens server-side.

**It is not live-connected yet.** Tenant metadata, client credentials, a customer-safe portal ID, and a successful end-to-end test are required. Do not paste secrets into GitHub or chat; configure them with Cloudflare secrets. Follow `egain/CONNECTOR_SETUP.md`.

## Local development

```bash
npm install
npm run dev:worker
```

Review `wrangler.toml`, configure your Cloudflare resources and secrets, and deploy only to a protected preview until the security checklist and test matrix pass. The public static site can be hosted separately as a static site; keep the Worker API origin protected.

## Status

This is a hackathon demo scaffold with defensive controls and an integration adapter. It has not undergone independent penetration testing, has not been deployed to a production domain, and has not completed a live eGain tenant connection or end-to-end security test.
