# eGain go-live blockers and required owner inputs

The repository does not contain an eGain tenant session or admin API credentials. The GitHub/Vercel connection cannot publish an agent inside the customer's eGain tenant. These are account-side steps that must be completed by an authorised eGain administrator.

## Required from the eGain tenant owner

1. eGain tenant URL and environment (sandbox/test preferred).
2. Confirmation that the account has AI Agent / AI Services and Knowledge Hub entitlements.
3. A dedicated test portal ID and approved customer-safe content.
4. A server-side OAuth client with the minimum read scopes for knowledge answers.
5. Exact Token URL and API base URL from the tenant's client metadata.
6. A staffed fraud escalation queue and a staffed hardship escalation queue, plus hours and fallback contacts.
7. The eGain-supported workflow action or API contract for creating a handoff/case, including required fields and success response.
8. Approved English policy articles; Hindi translations and reviewer approval if Hindi is to be advertised.
9. A named administrator to publish the test agent and grant reviewer access.

## Safe credential handling

Never paste client secrets, access tokens, admin passwords, customer records, or bank credentials into ChatGPT or GitHub. Enter secrets only in the authorised Cloudflare secret store. Share non-secret configuration identifiers only when permitted by the tenant owner.

## Completion evidence required

- Published test-agent URL and publish timestamp.
- Successful OAuth token request and knowledge answer request (redact tokens).
- Source article IDs returned for representative fraud and hardship questions.
- Handoff event showing the actual queue accepted the request.
- Completed 24-scenario test log, including failures and remediation.
- Security and privacy sign-off.

Until this evidence exists, status must remain **NOT CONNECTED / NOT PUBLISHED**.
