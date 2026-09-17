import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// The server reads DATA_DIR at import time, so point it at a temp directory
// before loading the module.
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flappy-scores-'));
process.env.DATA_DIR = dataDir;

const { createRequestHandler } = await import('./server.js');

let server;
let baseUrl;

function run(overrides = {}) {
  return { name: 'Ada', score: 10, table: 4, speed: 2, streak: 5, ...overrides };
}

function post(body, { raw = false } = {}) {
  return fetch(`${baseUrl}/api/scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body)
  });
}

beforeAll(async () => {
  const handler = createRequestHandler();
  server = http.createServer((req, res) => {
    handler(req, res).catch(() => res.destroy());
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('GET /api/health', () => {
  test('reports that the server is up', async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
  });
});

describe('scores API', () => {
  test('starts with an empty leaderboard', async () => {
    const response = await fetch(`${baseUrl}/api/scores`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ entries: [] });
  });

  test('accepts a run and returns its rank', async () => {
    const response = await post(run());

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.rank).toBe(1);
    expect(body.entries[0]).toMatchObject({ name: 'Ada', score: 10, table: 4 });
  });

  test('the submitted run appears on the leaderboard', async () => {
    const response = await fetch(`${baseUrl}/api/scores?table=4`);
    const body = await response.json();

    expect(body.entries.map(e => e.name)).toContain('Ada');
  });

  test('server assigns the date rather than trusting the client', async () => {
    await post(run({ name: 'Dater', date: '1999-01-01T00:00:00.000Z' }));
    const body = await (await fetch(`${baseUrl}/api/scores?table=4`)).json();
    const entry = body.entries.find(e => e.name === 'Dater');

    expect(entry.date.startsWith('1999')).toBe(false);
  });

  test('filters by table', async () => {
    await post(run({ name: 'Bob', table: 9, score: 30 }));

    const table9 = await (await fetch(`${baseUrl}/api/scores?table=9`)).json();
    expect(table9.entries.map(e => e.name)).toEqual(['Bob']);

    const table4 = await (await fetch(`${baseUrl}/api/scores?table=4`)).json();
    expect(table4.entries.map(e => e.name)).not.toContain('Bob');
  });

  test('merges all tables when no table is given', async () => {
    const body = await (await fetch(`${baseUrl}/api/scores?limit=50`)).json();

    expect(body.entries.length).toBeGreaterThan(1);
    expect(body.entries[0].score).toBeGreaterThanOrEqual(body.entries[1].score);
  });

  test('rejects an invalid table filter', async () => {
    const response = await fetch(`${baseUrl}/api/scores?table=abc`);

    expect(response.status).toBe(400);
  });

  test('clamps an absurd limit', async () => {
    const response = await fetch(`${baseUrl}/api/scores?limit=100000`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries.length).toBeLessThanOrEqual(50);
  });

  test('rejects a run with an invalid table', async () => {
    const response = await post(run({ table: 99 }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid-table');
  });

  test('rejects a run without a name', async () => {
    const response = await post(run({ name: '  ' }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid-name');
  });

  test('rejects malformed JSON', async () => {
    const response = await post('{not json', { raw: true });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid-json');
  });

  test('rejects an oversized body', async () => {
    const response = await post(run({ name: 'x'.repeat(20000) }));

    expect(response.status).toBe(413);
    expect((await response.json()).error).toBe('too-large');
  });

  test('rejects unsupported methods', async () => {
    const response = await fetch(`${baseUrl}/api/scores`, { method: 'PUT' });

    expect(response.status).toBe(405);
  });

  test('returns JSON 404 for unknown API routes', async () => {
    const response = await fetch(`${baseUrl}/api/nope`);

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe('not-found');
  });

  test('persists submitted scores to disk', async () => {
    // Give the queued atomic write a moment to land.
    await new Promise(resolve => setTimeout(resolve, 50));
    const saved = JSON.parse(await fs.readFile(path.join(dataDir, 'scores.json'), 'utf8'));

    expect(saved.tables['4'].some(e => e.name === 'Ada')).toBe(true);
  });
});

describe('static files', () => {
  test('serves the game at the root', async () => {
    const response = await fetch(`${baseUrl}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('game-canvas');
  });

  test('serves game modules as JavaScript', async () => {
    const response = await fetch(`${baseUrl}/js/highscores.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');
  });

  test('does not serve server source', async () => {
    const response = await fetch(`${baseUrl}/server/server.js`);
    const text = await response.text();

    expect(text).not.toContain('node:http');
  });

  test('does not serve package manifests', async () => {
    const response = await fetch(`${baseUrl}/package.json`);
    const text = await response.text();

    expect(text).not.toContain('devDependencies');
  });

  test('does not escape the project directory', async () => {
    const response = await fetch(`${baseUrl}/../../etc/passwd`);
    const text = await response.text();

    expect(text).not.toContain('root:');
  });

  test('does not serve test files', async () => {
    const response = await fetch(`${baseUrl}/js/highscores.test.js`);
    const text = await response.text();

    expect(text).not.toContain('describe(');
  });

  test('returns 404 for a missing asset', async () => {
    const response = await fetch(`${baseUrl}/js/does-not-exist.js`);

    expect(response.status).toBe(404);
  });
});

describe('social preview assets', () => {
  test('serves the Open Graph image and icons as PNG', async () => {
    for (const file of ['og-image.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png']) {
      const response = await fetch(`${baseUrl}/${file}`);
      expect(response.status, file).toBe(200);
      expect(response.headers.get('content-type'), file).toBe('image/png');
    }
  });

  test('the page carries Open Graph and Twitter card tags', async () => {
    const html = await (await fetch(`${baseUrl}/`)).text();
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('name="twitter:card"');
    expect(html).toContain('og-image.png');
  });
});
