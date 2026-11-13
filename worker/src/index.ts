import postgres from 'postgres';
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface RateLimit { limit(input: { key: string; delta?: number }): Promise<{ success: boolean }> }
interface Env {
  DB: Hyperdrive;
  ACCESS_ISSUER: string;
  ACCESS_AUD: string;
  CASE_LIMITER: RateLimit;
  EGAIN_TOKEN_URL?: string;
  EGAIN_API_BASE_URL?: string;
  EGAIN_PORTAL_ID?: string;
  EGAIN_LANGUAGE?: string;
  EGAIN_CLIENT_ID?: string;
  EGAIN_CLIENT_SECRET?: string;
  EGAIN_SCOPE?: string;
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
const blockedSecret = (value: string) =>
  /(?:\d[ -]?){13,19}/.test(value) ||
  /\b\d{8,}\b/.test(value) ||
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) ||
  /\b(pin|password|passcode|otp|one.?time code|cvv|cvc|security code)\s*(?:is|[:=])\s*\S+/i.test(value);

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
  if (!cleaned || cleaned.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(cleaned) || blockedSecret(cleaned)) return null;
  return cleaned;
}
async function readJsonBody(request: Request, maxBytes: number): Promise<Record<string, unknown> | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const parsed: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as Record<string, unknown>;
}

function validPath(value: unknown): value is SupportPath { return value === 'fraud' || value === 'hardship'; }
function validUrgency(value: unknown): value is Urgency { return value === 'high' || value === 'unclear' || value === 'normal'; }
function trustedEgainUrl(raw: string | undefined, allowPath: boolean): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) return null;
    if (!(u.hostname === 'egain.cloud' || u.hostname.endsWith('.egain.cloud'))) return null;
    if (allowPath && (!/^\/system\/auth\/[A-Za-z0-9_-]+\/oauth2\/token$/.test(u.pathname) || u.search)) return null;
    if (!allowPath && (u.pathname !== '/' || u.search)) return null;
    return u;
  } catch { return null; }
}

let tokenCache: { token: string; expiresAt: number; scopeKey: string } | null = null;
async function getEgainToken(env: Env): Promise<string> {
  const tokenUrl = trustedEgainUrl(env.EGAIN_TOKEN_URL, true);
  const clientId = env.EGAIN_CLIENT_ID;
  const clientSecret = env.EGAIN_CLIENT_SECRET;
  const scope = env.EGAIN_SCOPE || 'app.knowledge.portalmgr.read app.core.aiservices.read';
  if (!tokenUrl || !clientId || !clientSecret) throw new Error('EGAIN_NOT_CONFIGURED');
  const scopeKey = `${tokenUrl.origin}${tokenUrl.pathname}:${clientId}:${scope}`;
  if (tokenCache && tokenCache.scopeKey === scopeKey && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope });
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'accept': 'application/json' },
    body: form,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('EGAIN_AUTH_FAILED');
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (typeof data.access_token !== 'string' || !data.access_token || data.access_token.length > 8192) throw new Error('EGAIN_INVALID_TOKEN_RESPONSE');
  const ttl = Math.max(60, Math.min(Number(data.expires_in) || 300, 3600));
  tokenCache = { token: data.access_token, expiresAt: Date.now() + ttl * 1000, scopeKey };
  return data.access_token;
}

async function egainAnswer(env: Env, query: string): Promise<unknown> {
  const apiBase = trustedEgainUrl(env.EGAIN_API_BASE_URL, false);
  const portal = env.EGAIN_PORTAL_ID;
  if (!apiBase || !portal || !/^[A-Za-z0-9_-]{1,80}$/.test(portal)) throw new Error('EGAIN_NOT_CONFIGURED');
  const token = await getEgainToken(env);
  const endpoint = new URL(`/core/aiservices/v4/${encodeURIComponent(portal)}/answers`, apiBase);
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('$lang', env.EGAIN_LANGUAGE || 'en-US');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('EGAIN_ANSWER_FAILED');
  const text = await response.text();
  if (text.length > 80_000) throw new Error('EGAIN_RESPONSE_TOO_LARGE');
  try { return JSON.parse(text); } catch { throw new Error('EGAIN_INVALID_RESPONSE'); }
}

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
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ status: 'ok' });
    if (!url.pathname.startsWith('/api/')) return error('Not found', 404);
    if (request.method !== 'GET' && request.method !== 'POST') return error('Method not allowed', 405);
    if (request.headers.has('origin') && request.headers.get('origin') !== url.origin) return error('Cross-origin requests are not accepted', 403);

    const identity = await authenticate(request, env);
    if (!identity) return error('Authentication required', 401);
    try {
      const { success } = await env.CASE_LIMITER.limit({ key: `kintsugi-api:${identity.sub}` });
      if (!success) return error('Too many requests. Please wait before trying again.', 429);
    } catch { return error('Service temporarily unavailable. Please try again later.', 503); }

    try {
      if (request.method === 'POST' && url.pathname === '/api/knowledge/answer') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return error('JSON content is required', 415);
        const size = Number(request.headers.get('content-length') || 0);
        if (size > 3000) return error('Request is too large', 413);
        let body: Record<string, unknown> | null;
        try { body = await readJsonBody(request, 3000); } catch (e) { return error(e instanceof Error && e.message === 'BODY_TOO_LARGE' ? 'Request is too large' : 'Invalid JSON body', e instanceof Error && e.message === 'BODY_TOO_LARGE' ? 413 : 400); }
        if (!body) return error('Invalid request body', 400);
        const query = cleanText(body.query, 500);
        if (!query) return error('Ask a short policy question. Never include account credentials or card details.', 422);
        const answer = await egainAnswer(env, query);
        return json({ source: 'eGain Knowledge Hub', answer });
      }

      if (request.method === 'POST' && url.pathname === '/api/cases') {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return error('JSON content is required', 415);
        const size = Number(request.headers.get('content-length') || 0);
        if (size > 5000) return error('Request is too large', 413);
        let body: Record<string, unknown> | null;
        try { body = await readJsonBody(request, 5000); } catch (e) { return error(e instanceof Error && e.message === 'BODY_TOO_LARGE' ? 'Request is too large' : 'Invalid JSON body', e instanceof Error && e.message === 'BODY_TOO_LARGE' ? 413 : 400); }
        if (!body) return error('Invalid request body', 400);
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
      const code = err instanceof Error ? err.message : '';
      if (code === 'NO_ACTIVE_TENANT_MEMBERSHIP') return error('No active workspace membership', 403);
      if (code === 'EGAIN_NOT_CONFIGURED') return error('Knowledge service is not connected yet. Please contact a specialist.', 503);
      console.error('Kintsugi API request failed', { route: url.pathname, category: code.startsWith('EGAIN_') ? 'knowledge_provider_error' : 'internal_error' });
      return error('The request could not be completed. Please contact your bank directly for urgent account protection.', 502);
    }
  }
};
