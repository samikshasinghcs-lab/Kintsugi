# Cloudflare deployment and PostgreSQL RLS checklist

## Request and trust flow

1. Cloudflare Access authenticates the caller and sends `Cf-Access-Jwt-Assertion`.
2. The Worker verifies the JWT signature against the Access team's published JWKS, plus the exact issuer and application audience.
3. The verified JWT `sub` is used as the identity key. A client-provided tenant ID is never accepted.
4. Inside one PostgreSQL transaction, the Worker sets transaction-local `app.user_sub` and resolves one active default membership.
5. The Worker sets transaction-local `app.tenant_id`, then reads/writes cases and events under PostgreSQL RLS.
6. Hyperdrive may pool database connections. `set_config(..., true)` is transaction-local so context does not leak when a connection is reused.

## Database provisioning

Apply `worker/migrations/0001_initial.sql` with a migration/admin role. Create a dedicated runtime LOGIN role using a secret manager and grant only the listed privileges. The runtime role must:

- Not own the protected tables.
- Not be a superuser.
- Not have `BYPASSRLS`.
- Not be able to alter policies or schemas.
- Have only SELECT on memberships, SELECT/INSERT/UPDATE on cases, and SELECT/INSERT on case_events.

`FORCE ROW LEVEL SECURITY` is enabled on memberships, cases, and case_events. The membership policy allows a subject to read only its own active membership rows. Case and event policies require the transaction-local tenant UUID.

## Cloudflare setup

1. Create a Cloudflare Access application protecting the Worker/API hostname.
2. Configure an Access policy for intended reviewers/users.
3. Create a Hyperdrive configuration pointing to PostgreSQL using the restricted runtime role.
4. Put the Hyperdrive configuration ID in `wrangler.toml`.
5. Set `ACCESS_ISSUER` to the exact Access team issuer URL and `ACCESS_AUD` to the Access application audience.
6. Keep database credentials in Hyperdrive/Cloudflare secret management. Never put credentials in source control or client-side JavaScript.
7. Deploy to a preview environment first and run the negative tests below.

## Required negative tests

- No Access JWT → 401.
- Expired, wrong-issuer, or wrong-audience JWT → 401.
- Valid JWT with no active default membership → 403.
- Tenant A cannot list or retrieve Tenant B cases.
- Tenant A cannot insert a case with Tenant B's tenant ID (the API never accepts one; RLS also rejects a forged write).
- Reuse a pooled connection: Tenant A request followed by Tenant B request must never expose Tenant A's transaction context.
- Anonymous request cannot call any case endpoint.
- Request body containing card-like 13–19 digit values or credential labels is rejected.
- User-supplied summary length over 3,000 characters is rejected.
- Attempt to use the runtime role to disable RLS, alter policies, or bypass RLS must fail.

## Important limitations

This is a starter implementation, not a completed Cloudflare account setup or production security certification. It does not configure Access, provision Hyperdrive, create the runtime database credential, seed memberships, deploy the Worker, or connect eGain. Review the schema, identity mapping, grants, logging, data-retention rules, and incident response plan with the deploying team before real customer data is used.

## Worker rate limiting and eGain

The Worker requires a Cloudflare Rate Limiting binding named `CASE_LIMITER`, configured in `wrangler.toml`. Choose a namespace ID unique within your Cloudflare account. The configured limit is approximate and per Cloudflare location, not a strict global quota.

The Worker APIs remain behind Cloudflare Access. Add a separate WAF rate-limit rule before authentication for `/api/*`, because unauthenticated traffic does not reach the identity-based Worker limiter. Follow `docs/EDGE_ABUSE_CONTROLS.md`.

For eGain, set the tenant metadata in `wrangler.toml` and store `EGAIN_CLIENT_ID` and `EGAIN_CLIENT_SECRET` with `wrangler secret put`. Use the dedicated read-only scopes. The eGain adapter is not live until credentials, portal metadata, and a successful tenant test are complete. See `egain/CONNECTOR_SETUP.md`.

## Static site hosting

The repository includes both Cloudflare Pages `_headers` and `vercel.json` security-header configuration. Verify the deployed response headers from the actual production domain. HSTS is scoped to the host only; expand to subdomains only after every subdomain is confirmed HTTPS-only.
