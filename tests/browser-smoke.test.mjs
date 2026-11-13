import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(new URL('..', import.meta.url).pathname);
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8' };
let server;
let browser;
let base;

test('Kintsugi critical browser journeys work without transmitting or storing user choices', async (t) => {
  server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const body = await readFile(file === root ? resolve(root, 'index.html') : file);
      res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  t.after(async () => {
    await browser?.close();
    await new Promise((resolveClose) => server?.close(resolveClose));
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requests = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(base)) requests.push(request.url());
  });
  await page.goto(base, { waitUntil: 'networkidle' });

  assert.match(await page.title(), /Kintsugi/i);
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('body').evaluate((el) => el.scrollWidth <= window.innerWidth), true);
  assert.equal(requests.length, 0);

  await page.getByRole('button', { name: /I think I’ve been scammed/i }).click();
  await page.getByRole('button', { name: /Yes, money moved or is pending/i }).click();
  await page.getByRole('button', { name: /I have contacted my bank/i }).click();
  const fraudSummary = await page.locator('#summary').innerText();
  assert.match(fraudSummary, /contacted their bank/i);
  assert.match(fraudSummary, /No bank action or case submission/i);

  await page.getByRole('button', { name: /Start over/i }).click();
  await page.getByRole('button', { name: /I’m struggling with payments/i }).click();
  await page.getByRole('button', { name: /My income has stopped/i }).click();
  await page.getByRole('button', { name: /I want to prepare what to ask/i }).click();
  assert.match(await page.locator('#summary').innerText(), /hardship/i);

  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage).length,
    session: Object.keys(sessionStorage).length,
    cookies: document.cookie
  }));
  assert.deepEqual(storage, { local: 0, session: 0, cookies: '' });
  assert.equal(requests.length, 0);
});
