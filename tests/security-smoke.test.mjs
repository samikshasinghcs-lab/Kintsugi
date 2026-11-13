import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('public demo does not collect free text, files, or payment credentials', async () => {
  const html = await read('../index.html');
  assert.doesNotMatch(html, /<input\b/i);
  assert.doesNotMatch(html, /type\s*=\s*["']file["']/i);
  assert.doesNotMatch(html, /<form\b/i);
  assert.match(html, /Independent demo/i);
  assert.match(html, /We will never ask you for a PIN/i);
});

test('public browser code does not transmit or persist user choices', async () => {
  const js = await read('../assets/app.js');
  assert.doesNotMatch(js, /fetch\s*\(/);
  assert.doesNotMatch(js, /XMLHttpRequest|WebSocket|sendBeacon/i);
  assert.doesNotMatch(js, /localStorage|sessionStorage|indexedDB|document\.cookie/i);
  assert.match(js, /navigator\.clipboard\.writeText/);
});

test('static site has restrictive response headers', async () => {
  const headers = await read('../_headers');
  assert.match(headers, /Content-Security-Policy:.*default-src 'self'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /Referrer-Policy: no-referrer/);
  assert.match(headers, /Permissions-Policy:/);
});

test('worker keeps eGain credentials server-side and protects API routes', async () => {
  const worker = await read('../worker/src/index.ts');
  assert.match(worker, /Cf-Access-Jwt-Assertion/);
  assert.match(worker, /jwtVerify\(/);
  assert.match(worker, /CASE_LIMITER\.limit/);
  assert.match(worker, /EGAIN_CLIENT_SECRET/);
  assert.match(worker, /authorization: `Bearer ${token}`/);
  assert.match(worker, /BODY_TOO_LARGE/);
  assert.doesNotMatch(worker, /Access-Control-Allow-Origin\s*:\s*\*/i);
});

test('database schema enforces tenant boundaries on cases and events', async () => {
  const sql = await read('../worker/migrations/0001_initial.sql');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /WITH CHECK \(tenant_id = nullif\(current_setting\('app\.tenant_id'/);
  assert.match(sql, /case_events_same_tenant_case_fk/);
});
