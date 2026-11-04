// Tests for the local API: `npm run test:api` (node:test, no extra packages).
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { after, before, beforeEach, describe, it } from 'node:test';
import { startApi } from './main.mjs';

const transaction = (id, overrides = {}) => ({
  id,
  order: 0,
  date: '2026-10-01',
  month: '2026-10',
  amount: -1268.32,
  balanceAfter: 3000.1,
  account: 'NL11RABO0123456789',
  counterpartyIban: 'NL44RABO0300000001',
  counterpartyName: 'Rabobank Hypotheken',
  description: 'Hypotheek',
  code: 'ei',
  ...overrides,
});

describe('local API', () => {
  let api;
  let base;

  before(async () => {
    api = await startApi({ port: 0, file: ':memory:' });
    base = `http://127.0.0.1:${api.port}/api`;
  });

  after(() => api.close());

  beforeEach(async () => {
    await fetch(`${base}/transactions`, { method: 'DELETE' });
  });

  const post = (path, body, init = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      body: JSON.stringify(body),
    });

  it('reports its health', async () => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, database: ':memory:', transactions: 0 });
  });

  it('stores transactions and skips ids it already has', async () => {
    const first = await post('/transactions', [
      transaction('a'),
      transaction('b', { order: 1, balanceAfter: null }),
    ]);
    assert.deepEqual(await first.json(), { added: 2, duplicates: 0 });

    const second = await post('/transactions', [transaction('b'), transaction('c', { order: 2 })]);
    assert.deepEqual(await second.json(), { added: 1, duplicates: 1 });

    const list = await (await fetch(`${base}/transactions`)).json();
    assert.deepEqual(
      list.map((t) => t.id),
      ['a', 'b', 'c'],
    );
    assert.deepEqual(list[0], transaction('a'));
    assert.equal(list[1].balanceAfter, null);
  });

  it('keeps amounts exact by storing cents', async () => {
    await post('/transactions', [
      transaction('x', { amount: 0.1 + 0.2, balanceAfter: 1234567.89 }),
    ]);
    const [stored] = await (await fetch(`${base}/transactions`)).json();
    assert.equal(stored.amount, 0.3);
    assert.equal(stored.balanceAfter, 1234567.89);
  });

  it('deletes all transactions', async () => {
    await post('/transactions', [transaction('a'), transaction('b')]);
    const response = await fetch(`${base}/transactions`, { method: 'DELETE' });
    assert.deepEqual(await response.json(), { deleted: 2 });
    assert.deepEqual(await (await fetch(`${base}/transactions`)).json(), []);
  });

  it('stores settings as one document', async () => {
    const settings = { personNames: ['Maarten', 'Wendy'], split: { mode: 'percent' } };
    const put = await fetch(`${base}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    assert.equal(put.status, 200);
    assert.deepEqual(await (await fetch(`${base}/settings`)).json(), settings);
  });

  it('rejects invalid transactions', async () => {
    const response = await post('/transactions', [{ id: 'kapot' }]);
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /date|datum/);
    assert.equal((await post('/transactions', { niet: 'een lijst' })).status, 400);
  });

  it('only accepts JSON bodies', async () => {
    const response = await fetch(`${base}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '[]',
    });
    assert.equal(response.status, 415);
  });

  it('refuses requests from other websites', async () => {
    const response = await post('/transactions', [], {
      headers: { Origin: 'https://evil.example' },
    });
    assert.equal(response.status, 403);
    const local = await post('/transactions', [], { headers: { Origin: 'http://localhost:4200' } });
    assert.equal(local.status, 200);
  });

  it('refuses requests addressed to another host name (DNS rebinding)', async () => {
    const status = await new Promise((resolve, reject) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: api.port,
          path: '/api/transactions',
          headers: { Host: 'evil.example' },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 403);
  });

  it('answers 404 for unknown routes', async () => {
    assert.equal((await fetch(`${base}/onbekend`)).status, 404);
  });
});
