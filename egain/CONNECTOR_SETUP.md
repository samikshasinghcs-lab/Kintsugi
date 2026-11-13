# eGain Knowledge Hub connector — Kintsugi

## What is implemented

The Worker contains a server-side, read-only eGain Answers API adapter at POST /api/knowledge/answer. It:
- Requires Cloudflare Access JWT authentication.
- Applies the Worker rate-limit binding to the verified identity.
- Validates and bounds the question.
- Obtains an OAuth 2.0 client-credentials token server-side.
- Calls the eGain AI Services Answers API for one configured portal.
- Never returns the OAuth token or client secret to the browser.
- Fails closed when configuration is missing.

**It is not live-connected yet.** No eGain tenant credentials, portal ID, or application metadata have been supplied/configured, and no live API call has been tested.

## Official API flow used

The eGain developer portal documents OAuth 2.0 Client Credentials for server-to-server calls. It documents the Answers endpoint as:

POST https://<API_DOMAIN>/core/aiservices/v4/<PORTAL_ID>/answers?q=<QUESTION>&$lang=<LANGUAGE>

The documented read scopes are:
- app.knowledge.portalmgr.read
- app.core.aiservices.read

Use the exact Token URL and API Domain shown in your own eGain Client Application Metadata. The Worker currently permits HTTPS eGain cloud hosts only.

Official references:
- API authentication: https://apidev.egain.com/developer-portal/get-started/authentication_guide
- Knowledge Hub quickstart and Answers API: https://apidev.egain.com/developer-portal/get-started/quickstart

## Configure safely

1. In eGain Administration, create a dedicated server-side Client Application.
2. Grant only the two read scopes above. Do not grant content-management write permissions to the runtime answer client.
3. Copy the Token URL, API Domain, and the customer-safe Portal ID from eGain metadata.
4. Set the non-secret metadata in wrangler.toml:
   - EGAIN_TOKEN_URL
   - EGAIN_API_BASE_URL
   - EGAIN_PORTAL_ID
   - EGAIN_LANGUAGE
   - EGAIN_SCOPE
5. Store credentials using Cloudflare secrets, never Git:
   npx wrangler secret put EGAIN_CLIENT_ID
   npx wrangler secret put EGAIN_CLIENT_SECRET
6. Deploy to a protected preview environment. Keep /api/knowledge/answer behind Cloudflare Access.
7. Test with harmless policy questions only. Never send customer names, emails, phone numbers, account/card numbers, transaction narratives, or authentication secrets to the knowledge API.
8. Confirm the answer cites or identifies the approved source article, handles missing knowledge safely, and never invents eligibility, legal requirements, deadlines, or recovery outcomes.

## Knowledge portal boundary

Import the eight documents under knowledge-base/ only after reviewing and adapting the fictional Northfield Bank policies to the actual demo narrative. Clearly label them as demonstration policies. Use a portal containing only approved customer-safe content. Do not place case records, customer PII, fraud evidence, internal-only notes, secrets, or admin runbooks in the public-answer portal.

## Important

This connector is an integration seam, not proof of a connected eGain tenant. A successful connection requires the account-specific metadata and secrets above, a valid portal, assigned scopes, network access, and a successful test response from the tenant. Do not claim eGain is connected until that end-to-end test passes.
