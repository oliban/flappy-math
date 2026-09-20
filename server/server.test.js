import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// The server reads DATA_DIR at import time, so point it at a temp directory
// before loading the module.
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flappy-scores-'));
process.env.DATA_DIR = dataDir;

// A stub standing in for Open-Meteo: the real provider is a third party, and
// the point of this feature is that the server - not the browser - calls it.
const upstream = { forecastCalls: [], searchCalls: [], failing: false };

const upstreamServer = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://upstream.test');

  if (upstream.failing) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end('{}');
  }

  if (url.pathname === '/v1/forecast') {
    upstream.forecastCalls.push(url.search);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      current: { temperature_2m: 12.7, weather_code: 61, wind_speed_10m: 3.5, is_day: 1 }
    }));
  }

  if (url.pathname === '/v1/search') {
    upstream.searchCalls.push(url.searchParams.get('name'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      results: [
        { name: 'Stockholm', country: 'Sweden', admin1: 'Stockholm', latitude: 59.3293, longitude: 18.0686 }
      ]
    }));
  }

  res.writeHead(404);
  res.end();
});

await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
const upstreamBase = `http://127.0.0.1:${upstreamServer.address().port}`;
process.env.WEATHER_API_URL = `${upstreamBase}/v1/forecast`;
process.env.GEOCODING_API_URL = `${upstreamBase}/v1/search`;

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
  await new Promise(resolve => upstreamServer.close(resolve));
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

describe('weather API', () => {
  test('serves Mölndal weather without being told a location', async () => {
    const response = await fetch(`${baseUrl}/api/weather`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.weather).toMatchObject({ temperature: 12.7, code: 61 });
    expect(body.weather.location.name).toBe('Mölndal');
  });

  test('the server is the one that called the provider', async () => {
    expect(upstream.forecastCalls.length).toBeGreaterThan(0);
    expect(upstream.forecastCalls[0]).toContain('latitude=57.6554');
  });

  test('answers a repeat request from cache instead of the provider', async () => {
    const before = upstream.forecastCalls.length;
    const body = await (await fetch(`${baseUrl}/api/weather`)).json();

    expect(upstream.forecastCalls.length).toBe(before);
    expect(body.cached).toBe(true);
  });

  test('serves another location when coordinates are given', async () => {
    const response = await fetch(`${baseUrl}/api/weather?lat=59.3293&lon=18.0686&name=Stockholm`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.weather.location).toMatchObject({ name: 'Stockholm', latitude: 59.3293 });
  });

  test('rejects nonsense coordinates', async () => {
    const response = await fetch(`${baseUrl}/api/weather?lat=999&lon=0`);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid-coordinates');
  });

  test('falls back to the default location when only one coordinate is given', async () => {
    const body = await (await fetch(`${baseUrl}/api/weather?lat=59.3293`)).json();

    expect(body.weather.location.name).toBe('Mölndal');
  });

  test('rejects unsupported methods', async () => {
    const response = await fetch(`${baseUrl}/api/weather`, { method: 'POST' });

    expect(response.status).toBe(405);
  });

  test('looks up places by name', async () => {
    const response = await fetch(`${baseUrl}/api/weather/search?q=stockholm`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.places[0]).toMatchObject({ name: 'Stockholm', country: 'Sweden' });
    expect(upstream.searchCalls).toContain('stockholm');
  });

  test('rejects an empty place query', async () => {
    const response = await fetch(`${baseUrl}/api/weather/search?q=`);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('invalid-query');
  });

  test('reports upstream trouble rather than crashing', async () => {
    upstream.failing = true;
    try {
      const response = await fetch(`${baseUrl}/api/weather/search?q=goteborg`);

      expect(response.status).toBe(503);
      expect((await response.json()).error).toBe('upstream');
    } finally {
      upstream.failing = false;
    }
  });

  test('keeps serving a cached reading while the provider is down', async () => {
    upstream.failing = true;
    try {
      const body = await (await fetch(`${baseUrl}/api/weather`)).json();

      expect(body.weather.temperature).toBe(12.7);
    } finally {
      upstream.failing = false;
    }
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
