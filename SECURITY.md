# Kintsugi security and abuse-resistance policy

Kintsugi handles a high-risk topic: people who may already be under pressure from scammers. The product must not become a collection point, impersonation prop, or attractive target for criminals.

## Public-surface rules

- The public demo is a static, guided-choice experience. It has no free-text chat box, login, payment form, file upload, document upload, or public case-submission endpoint.
- Choices stay in browser memory only. The static demo does not send them to a server or persist them in local storage.
- The page does not request account identifiers, card details, passwords, PINs, CVVs, one-time codes, recovery phrases, or remote access.
- It does not use bank logos or pretend to be a bank, regulator, police service, or payment provider.
- Every view states that Kintsugi is an independent demonstration project and cannot block cards, reverse transfers, file real disputes, or recover money.
- The site must never initiate unsolicited calls, messages, or direct messages. It must never charge an upfront recovery fee or ask a user to move money to a “safe account”.

## Protected API

- All /api/* routes require a valid Cloudflare Access JWT with exact issuer and audience validation.
- The eGain client secret is server-side only. The browser never receives eGain OAuth tokens or secrets.
- eGain access is read-only and restricted to a customer-safe knowledge portal.
- API requests are streamed and size-limited; JSON is validated server-side.
- Likely payment-card numbers and labelled credentials are rejected before persistence or forwarding.
- Responses use no-store and restrictive security headers.
- Worker rate limiting is per verified identity. Cloudflare Workers rate-limit counters are approximate and per location; they are not a replacement for edge WAF controls.
- Database access uses a restricted runtime role, transaction-local tenant context, and PostgreSQL RLS. The runtime role must not own protected tables, be superuser, or have BYPASSRLS.

## Required Cloudflare controls before any public deployment

1. Put the site behind HTTPS only; enable DNSSEC and registrar transfer lock on the production domain.
2. Enable Cloudflare WAF managed rules and bot protections.
3. Add an edge rate-limit rule for /api/* before authentication. Challenge or block abusive bursts; tune for shared mobile networks and legitimate support traffic.
4. Keep the eGain API and all case-management endpoints behind Cloudflare Access until a reviewed public customer-authentication design exists.
5. Do not expose wrangler dev, preview URLs, database ports, or admin tools as production endpoints.
6. Keep Hyperdrive credentials, eGain client secrets, and Access configuration out of Git, frontend bundles, logs, screenshots, and issue trackers.
7. Use a dedicated eGain API client with only app.knowledge.portalmgr.read and app.core.aiservices.read; do not grant content-management write scopes to the runtime answer service.
8. Import only reviewed, public/customer-safe policy documents into the eGain portal used for customer answers. Do not ingest customer case records, credentials, internal escalation notes, or secrets into that portal.
9. Set a verified abuse-reporting contact and publish a security.txt only after the production domain and monitored contact are confirmed.
10. Before accepting real customer information, complete independent penetration testing, privacy/legal review, incident-response runbook, retention/deletion policy, backup controls, and an access audit.

## Threat model

| Threat | Main controls | Residual risk |
|---|---|---|
| Fake Kintsugi support accounts | No unsolicited outreach; anti-impersonation warning; independent-demo language; no recovery promises | Scammers can still clone the brand or copy the site |
| Credential harvesting | No credential fields, free text, uploads, or login; explicit never-ask pledge | A malicious clone can ignore these rules |
| Fake recovery fees / safe-account scams | Repeated warnings; no payment rails; no bank logos | Users may still be contacted outside the site |
| API scraping or abuse | Access JWT, rate limit, WAF, bounded input, no public case route | Rate limiting is approximate and misconfiguration remains possible |
| Prompt injection / malicious knowledge content | Curated read-only eGain portal; source review; no write tools in answer path | Poisoned source content can still mislead retrieval |
| Cross-tenant data access | Transaction-local identity/tenant context and RLS | Deployment role/grant mistakes must be tested in the real database |
| Secret leakage | Cloudflare secrets; no frontend credentials; sanitized logs | Operator mistakes and compromised admin accounts remain risks |
| Domain takeover | DNSSEC, registrar lock, least-privilege DNS access, monitored changes | Registrar or account compromise remains risks |

## Vulnerability reporting

Do not publish a personal email or contact channel until it is actively monitored. Until then, do not send sensitive details in public GitHub issues. Report suspected impersonation to the platform hosting it and contact your bank directly if money or account access is at risk.

## Security status

This repository contains defensive design and implementation controls, not a security certification. No system is scam-proof. The Cloudflare account, domain, eGain tenant, database roles, and production deployment still require configuration and independent verification.
