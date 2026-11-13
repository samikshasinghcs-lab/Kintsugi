# KINTSUGI — Financial Recovery Intelligence

**When life breaks your financial stability, we help you rebuild.**

KINTSUGI is a financial-crisis support experience for people facing suspected fraud or payment hardship. It combines guided triage, grounded policy knowledge, case preparation, and human escalation.

## Two recovery paths

- **Urgent Fraud:** immediate safe next steps, bank-contact guidance, evidence organization, dispute preparation, and escalation.
- **Payment & Bill Support:** hardship triage, policy-based options, payment-arrangement preparation, and specialist escalation.

## Project structure

- `index.html` — responsive customer-facing demo.
- `worker/src/index.ts` — Cloudflare Worker API.
- `worker/migrations/0001_initial.sql` — PostgreSQL case schema and tenant-isolation policies.
- `knowledge-base/` — eight grounded policy documents for the agent.
- `egain/FEATURES.md` — eGain agent, intents, workflows, and handoff configuration.
- `docs/CLOUDFLARE_DEPLOYMENT.md` — deployment and environment setup.
- `tests/TEST_MATRIX.md` — safety and workflow test cases.

## Safety boundaries

This is a hackathon/demo implementation. It does **not** connect to a real bank, block cards, reverse transfers, submit real disputes, or guarantee recovery. Never enter a PIN, password, or full card number. All demo actions must be labelled as simulated until an authorised institution integration confirms them.

## Local development

```bash
npm install
npm run dev
```

Review `wrangler.toml` and the Cloudflare deployment guide before deploying. Configure secrets and database bindings in your own Cloudflare account; do not commit credentials.

## eGain setup

Import the policy documents in `knowledge-base/` into the eGain Knowledge Hub, configure the intents and workflows described in `egain/FEATURES.md`, then test both paths and human escalation before publishing.

## Status

The source package is a demo scaffold. Cloudflare resources, eGain tenant configuration, bank integrations, and production security review must be completed separately.
