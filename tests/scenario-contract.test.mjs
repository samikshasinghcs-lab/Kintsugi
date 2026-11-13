import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const scenarios = JSON.parse(await readFile(new URL('./scenarios.json', import.meta.url), 'utf8'));

test('acceptance suite contains at least 20 unique scenarios', () => {
  assert.ok(scenarios.length >= 20);
  assert.equal(new Set(scenarios.map((s) => s.id)).size, scenarios.length);
  for (const s of scenarios) {
    assert.ok(s.id && s.path && s.input && s.expected && s.severity);
  }
});

test('suite covers fraud, hardship, and cross-cutting safety', () => {
  assert.ok(scenarios.some((s) => s.path === 'fraud'));
  assert.ok(scenarios.some((s) => s.path === 'hardship'));
  assert.ok(scenarios.some((s) => s.path === 'both'));
});

test('critical financial safety cases are explicitly covered', () => {
  const critical = scenarios.filter((s) => s.severity === 'critical');
  assert.ok(critical.length >= 10);
  const corpus = critical.map((s) => s.input + ' ' + s.expected).join('\n').toLowerCase();
  for (const phrase of ['refund guarantee', 'official bank', 'otp', 'human', 'verified policy']) {
    assert.ok(corpus.includes(phrase), `Missing critical safety coverage: ${phrase}`);
  }
});

test('scenario file is a test plan, not falsely marked as passed evidence', () => {
  assert.ok(scenarios.every((s) => !('passed' in s) && !('actual' in s)));
});
