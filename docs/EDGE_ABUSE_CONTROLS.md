# Edge abuse controls for Kintsugi

The Worker rate-limit binding protects authenticated API traffic after identity verification. Cloudflare documents that these counters are approximate and local to each Cloudflare location. They are useful friction, not a strict global quota.

Before public launch:

- Keep the current case and eGain routes behind Cloudflare Access.
- Add Cloudflare WAF managed rules and bot protections.
- Add a separate edge rate-limit rule for /api/* before Access/JWT validation so unauthenticated floods do not reach the Worker.
- Start with a conservative per-IP threshold and tune against real traffic; mobile carrier NAT and shared Wi-Fi can place many legitimate users behind one IP.
- Alert on spikes in 401, 403, 429, 5xx, and upstream eGain failures.
- Do not enable public anonymous case creation.
- If a public eGain knowledge-answer endpoint is ever needed, require Turnstile server-side verification, a public-read-only eGain portal, per-route abuse limits, strict query minimisation, and a privacy review first.
- Never rely on a client-side CAPTCHA, hidden field, or browser validation as the only protection.

No WAF rules or bot protections are created by committing this file; they must be configured and verified in the Cloudflare account.
