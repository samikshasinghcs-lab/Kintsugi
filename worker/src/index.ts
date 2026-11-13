import postgres from 'postgres';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  DB: Hyperdrive;
  ACCESS_ISSUER: string;
  ACCESS_AUD: string;
}

type AccessIdentity = { sub: string; email?: string };
type SupportPath = 'fraud' | 'hardship';
type Urgency = 'high' | 'unclear' | 'normal';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
});
const error = (message: string, status: number) => json({ error: message }, status);

async function authenticate(request: Request, env: Env): Promise<AccessIdentity | null> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_ISSUER || !env.ACCESS_AUD || env.ACCESS_ISSUER.includes('YOUR-TEAM')) return null;
  try {
    const issuer = env.ACCESS_ISSUER.replace(/\/$/, '');
    const jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD });
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  } catch {
    return null;
  }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > max) return null;
  if (/\b(?:\d[ -]*?){13,19}\b/.test(cleaned) || /\b(pin|password|passcode|otp|one.?time code|cvv|cvc)\s*[:=]/i.test(cleaned)) return null;
  return cleaned;
}

function validPath(value: unknown): value is SupportPath { return value === 'fraud' || value === 'hardship'; }
function validUrgency(value: unknown): value is Urgency { return value === 'high' || value === 'unclear' || value === 'normal'; }

async function withTenant<T>(env: Env, identity: AccessIdentity, run: (tx: any, tenantId: string) => Promise<T>): Promise<T | null> {
  const sql = postgres(env.DB.connectionString, { max: 1, fetch_types: false, prepare: false });
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
  } finally {
    await sql.end({ timeout: 2 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ status: 'ok', service: 'kintsugi-api', mode: 'protected-demo' });
    if (!url.pathname.startsWith('/api/')) return error('Not found', 404);
    if (request.method !== 'GET' && request.method !== 'POST') return error('Method not allowed', 405);
    const identity = await authenticate(request, env);
    if (!identity) return error('Authentication required', 401);

    try {
      if (request.method === 'POST' && url.pathname === '/api/cases') {
        let body: Record<string, unknown>;
        try { body = await request.json() as Record<string, unknown>; } catch { return error('Invalid JSON body', 400); }
        if (!validPath(body.supportPath) || !validUrgency(body.urgency)) return error('Invalid support path or urgency', 422);
        const summary = cleanText(body.summary, 3000);
        const displayName = body.displayName === undefined ? null : cleanText(body.displayName, 50);
        const issueCategory = body.issueCategory === undefined ? null : cleanText(body.issueCategory, 100);
        if (!summary) return error('A safe, concise case summary is required. Do not include account credentials or card details.', 422);
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
        if (!created) return error('No active tenant membership', 403);
        return json({ case: created }, 201);
      }

      if (request.method === 'GET' && url.pathname === '/api/cases') {
        const rows = await withTenant(env, identity, async (tx: any) => tx`
          select id, support_path, urgency, issue_category, status, created_at, updated_at
          from cases order by created_at desc limit 50
        `);
        if (!rows) return error('No active tenant membership', 403);
        return json({ cases: rows });
      }
      return error('Not found', 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      if (message === 'NO_ACTIVE_TENANT_MEMBERSHIP') return error('No active tenant membership', 403);
      console.error('Kintsugi API request failed', { path: url.pathname, message: 'internal_error' });
      return error('The request could not be completed. Please try again or contact a specialist.', 500);
    }
  }
};