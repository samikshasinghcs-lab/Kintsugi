import postgres from 'postgres';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface RateLimit { limit(input: { key: string; delta?: number }): Promise<{ success: boolean }> }
interface Env {
  DB: Hyperdrive;
  ACCESS_ISSUER: string;
  ACCESS_AUD: string;
  CASE_LIMITER: RateLimit;
}
type AccessIdentity = { sub: string };
type SupportPath = 'fraud' | 'hardship';
type Urgency = 'high' | 'unclear' | 'normal';

const SECURITY_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: SECURITY_HEADERS });
const error = (message: string, status: number) => json({ error: message }, status);

async function authenticate(request: Request, env: Env): Promise<AccessIdentity | null> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_ISSUER || !env.ACCESS_AUD || env.ACCESS_ISSUER.includes('YOUR-TEAM')) return null;
  try {
    const issuer = env.ACCESS_ISSUER.replace(/\/$/, '');
    const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'] });
    if (typeof payload.sub !== 'string' || payload.sub.length > 255) return null;
    return { sub: payload.sub };
  } catch { return null; }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.normalize('NFKC').trim();
  if (!cleaned || cleaned.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(cleaned)) return null;
  // Reject likely card numbers and credential disclosures instead of persisting them.
  if (/(?:\d[ -]?){13,19}/.test(cleaned) || /\b(pin|password|passcode|otp|one.?time code|cvv|cvc|security code)\s*[:=]/i.test(cleaned)) return null;
  return cleaned;
}
function validPath(value: unknown): value is SupportPath { return value === 'fraud' || value === 'hardship'; }
function validUrgency(value: unknown): value is Urgency { return value === 'high' || value === 'unclear' || value === 'normal'; }

async function withTenant<T>(env: Env, identity: AccessIdentity, run: (tx: any, tenantId: string) => Promise<T>): Promise<T> {
  const sql = postgres(env.DB.connectionString, { max: 1, fetch_types: false, prepare: false, idle_timeout: 5, connect_timeout: 5 });
  try {
    return await sql.begin(async (tx) => {
      await tx`select set_config('app.user_sub', ${identity.sub}, true)`;
      const rows = await tx<{ tenant_id: string }[]>`
        select tenant_id from memberships
        where subject = ${identity.sub} and active = true and is_default = true
        limit 2
      `;
      if (rows.length !== 1) throw new Error('NO_ACTIVE_TENANT_MEMBERSHIP');
      const tenantId = rows[0].tenant_id;
      await tx`select set_config('app.tenant_id', ${tenantId}, true)`;
      return await run(tx, tenantId);
    });
  } finally { await sql.end({ timeout: 2 }); }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      // Health reveals no database, account, deployment, or configuration details.
      return json({ status: 'ok' });
    }
    if (!url.pathname.startsWith('/api/')) return error('Not found', 404);
    if (request.method !== 'GET' && request.method !== 'POST') return error('Method not allowed', 405);
    if (request.headers.has('origin') && request.headers.get('origin') !== url.origin) return error('Cross-origin requests are not accepted', 403);

    const identity = await authenticate(request, env);
    if (!identity) return error('Authentication required', 401);

    // Per-verified-identity limit. Cloudflare's limiter is approximate per location;
    // add WAF rules and alerting before any public rollout.
    try {
      const { success } = await env.CASE_LIMITER.limit({ key: `case-api:${identity.sub}` });
      if (!success) return error('Too many requests. Please wait before trying again.', 429);
    } catch {
      // Fail closed: missing/misconfigured abuse control must not silently expose write paths.
      return error('Service temporarily unavailable. Please try again later.', 503);
    }

    try {
      if (request.method === 'POST' && url.pathname === '/api/cases') {
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.toLowerCase().startsWith('application/json')) return error('JSON content is required', 415);
        const declaredLength = Number(request.headers.get('content-length') || 0);
        if (declaredLength > 5000) return error('Request is too large', 413);
        let body: Record<string, unknown>;
        try { body = await request.json() as Record<string, unknown>; } catch { return error('Invalid JSON body', 400); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return error('Invalid request body', 400);
        if (!validPath(body.supportPath) || !validUrgency(body.urgency)) return error('Invalid support path or urgency', 422);
        const summary = cleanText(body.summary, 2000);
        const displayName = body.displayName === undefined || body.displayName === '' ? null : cleanText(body.displayName, 50);
        const issueCategory = body.issueCategory === undefined || body.issueCategory === '' ? null : cleanText(body.issueCategory, 80);
        if (!summary) return error('A short, safe summary is required. Do not include card details, passwords, PINs, or one-time codes.', 422);
        if (body.displayName !== undefined && body.displayName !== '' && !displayName) return error('Invalid display name', 422);
        if (body.issueCategory !== undefined && body.issueCategory !== '' && !issueCategory) return error('Invalid issue category', 422);

        const created = await withTenant(env, identity, async (tx: any, tenantId: string) => {
          const [row] = await tx`
            insert into cases (tenant_id, created_by_subject, customer_display_name, support_path, urgency, issue_category, summary)
            values (${tenantId}::uuid, ${identity.sub}, ${displayName}, ${body.supportPath}, ${body.urgency}, ${issueCategory}, ${summary})
            returning id, support_path, urgency, status, created_at
          `;
          await tx`
            insert into case_events (tenant_id, case_id, actor_subject, event_type, detail)
            values (${tenantId}::uuid, ${row.id}, ${identity.sub}, 'case_created', 'Case created through authenticated Kintsugi workflow')
          `;
          return row;
        });
        return json({ case: created }, 201);
      }

      if (request.method === 'GET' && url.pathname === '/api/cases') {
        const rows = await withTenant(env, identity, async (tx: any) => tx`
          select id, support_path, urgency, issue_category, status, created_at, updated_at
          from cases order by created_at desc limit 25
        `);
        return json({ cases: rows });
      }
      return error('Not found', 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message === 'NO_ACTIVE_TENANT_MEMBERSHIP') return error('No active workspace membership', 403);
      // Never log request bodies, JWTs, emails, transaction details, or customer summaries.
      console.error('Kintsugi API request failed', { route: url.pathname, category: 'internal_error' });
      return error('The request could not be completed. Please try again or contact your bank directly for urgent account protection.', 500);
    }
  }
};
