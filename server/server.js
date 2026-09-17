// Flappy Math server: serves the static game and the global leaderboard API.
// Zero dependencies - just the Node standard library.

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEmptyStore, parseStore, validateEntry, insertEntry, topEntries } from './scores.js';
import { createRateLimiter } from './rateLimit.js';
import { createWeatherService } from './weather.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'scores.json');

const MAX_BODY_BYTES = 4 * 1024;
// Hard cutoff: past this we stop draining an oversized body and hang up.
const HARD_BODY_LIMIT = 1024 * 1024;
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

// Directories that may be served. Everything else (server code, node_modules,
// dotfiles, tests) stays private.
const PUBLIC_DIRS = ['js', 'css', 'sounds'];
const PUBLIC_FILES = ['index.html', 'favicon.ico', 'robots.txt'];

const submitLimiter = createRateLimiter({ limit: 20, windowMs: 60 * 1000 });
const weather = createWeatherService();

let store = createEmptyStore();
let writeQueue = Promise.resolve();
let persistenceEnabled = true;

function loadStore() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    store = parseStore(JSON.parse(raw));
    console.log(`Loaded leaderboard from ${DATA_FILE}`);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn(`Could not read ${DATA_FILE}, starting empty:`, e.message);
    }
    store = createEmptyStore();
  }
}

// Writes are serialized and atomic (temp file + rename) so a crash mid-write
// cannot leave a truncated leaderboard behind.
function saveStore() {
  if (!persistenceEnabled) return writeQueue;

  const snapshot = JSON.stringify(store);
  writeQueue = writeQueue.then(async () => {
    const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
    try {
      await fsp.mkdir(DATA_DIR, { recursive: true });
      await fsp.writeFile(tempFile, snapshot, 'utf8');
      await fsp.rename(tempFile, DATA_FILE);
    } catch (e) {
      console.error('Failed to save leaderboard:', e.message);
      persistenceEnabled = false;
      console.error('Leaderboard persistence disabled; scores are in memory only.');
    }
  });

  return writeQueue;
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(payload);
}

function clientIp(req) {
  const forwarded = req.headers['fly-client-ip'] || req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      size += chunk.length;

      if (aborted) {
        // Keep draining so the client can finish writing and still read the
        // error response, but hang up on anything wildly oversized.
        if (size > HARD_BODY_LIMIT) req.destroy();
        return;
      }

      if (size > MAX_BODY_BYTES) {
        aborted = true;
        chunks.length = 0;
        resolve({ ok: false, error: 'too-large' });
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        resolve({ ok: true, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
      } catch (e) {
        resolve({ ok: false, error: 'invalid-json' });
      }
    });

    req.on('error', () => {
      if (!aborted) resolve({ ok: false, error: 'read-failed' });
    });
  });
}

function parseTableParam(value) {
  if (value === null || value === undefined || value === '') return { ok: true, table: null };

  const table = Number(value);
  if (!Number.isInteger(table)) return { ok: false };
  return { ok: true, table };
}

function parseLimitParam(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

function handleGetScores(req, res, url) {
  const table = parseTableParam(url.searchParams.get('table'));
  if (!table.ok) return sendJson(res, 400, { error: 'invalid-table' });

  const limit = parseLimitParam(url.searchParams.get('limit'));

  sendJson(res, 200, { entries: topEntries(store, { table: table.table, limit }) });
}

async function handlePostScore(req, res) {
  if (!submitLimiter.check(clientIp(req))) {
    return sendJson(res, 429, { error: 'rate-limited' });
  }

  const body = await readJsonBody(req);
  if (!body.ok) {
    if (body.error === 'too-large') {
      // The request body is still arriving; close the connection once the
      // error response has been flushed.
      res.on('finish', () => req.destroy());
      return sendJson(res, 413, { error: 'too-large' }, { Connection: 'close' });
    }
    return sendJson(res, 400, { error: body.error });
  }

  const validation = validateEntry(body.body);
  if (!validation.valid) return sendJson(res, 400, { error: validation.error });

  const { rank, tableRank } = insertEntry(store, validation.entry);
  saveStore();

  sendJson(res, 201, {
    rank: tableRank,
    overallRank: rank,
    entries: topEntries(store, { table: validation.entry.table, limit: DEFAULT_LIMIT })
  });
}

function cacheControlFor(ext) {
  if (ext === '.mp3' || ext === '.wav' || ext === '.ogg') return 'public, max-age=604800, immutable';
  if (ext === '.css' || ext === '.js' || ext === '.mjs') return 'public, max-age=86400';
  return 'no-cache';
}

// Resolves a request path to a file inside the published directories, or null.
function resolveStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT_DIR, relative);

  if (resolved !== ROOT_DIR && !resolved.startsWith(ROOT_DIR + path.sep)) return null;

  const fromRoot = path.relative(ROOT_DIR, resolved);
  const topLevel = fromRoot.split(path.sep)[0];

  if (PUBLIC_FILES.includes(fromRoot)) return resolved;
  if (PUBLIC_DIRS.includes(topLevel) && !fromRoot.endsWith('.test.js')) return resolved;

  return null;
}

function serveStatic(req, res, url) {
  const filePath = resolveStaticPath(url.pathname);

  // Anything unknown falls back to the game itself, matching the old SPA rule.
  const target = filePath || path.join(ROOT_DIR, 'index.html');
  const ext = path.extname(target).toLowerCase();

  fs.stat(target, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Cache-Control': cacheControlFor(ext)
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(target);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

export function createRequestHandler() {
  return async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, persistence: persistenceEnabled });
    }

    if (url.pathname === '/api/weather') {
      if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); return res.end(); }
      // Location: browser coordinates if sent, otherwise the client's IP, otherwise Mölndal
      const report = await weather.get({
        lat: url.searchParams.get('lat'),
        lon: url.searchParams.get('lon'),
        ip: clientIp(req)
      });
      console.log(`[weather] ${url.searchParams.has('lat') ? 'coords' : `ip ${clientIp(req)}`} → ${report.place}: ${report.condition} ${report.temperature}° wind ${report.windSpeed}${report.stale ? ' (stale)' : ''}`);
      return sendJson(res, 200, report, { 'Cache-Control': 'private, max-age=120' });
    }

    if (url.pathname === '/api/scores') {
      if (req.method === 'GET') return handleGetScores(req, res, url);
      if (req.method === 'POST') return handlePostScore(req, res);

      res.writeHead(405, { Allow: 'GET, POST' });
      return res.end();
    }

    if (url.pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'not-found' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }

    return serveStatic(req, res, url);
  };
}

export function startServer({ port = PORT, host = HOST } = {}) {
  loadStore();

  const server = http.createServer((req, res) => {
    createRequestHandler()(req, res).catch((e) => {
      console.error('Request failed:', e);
      if (!res.headersSent) sendJson(res, 500, { error: 'server-error' });
      else res.end();
    });
  });

  server.listen(port, host, () => {
    console.log(`Flappy Math listening on http://${host}:${port}`);
    console.log(`Leaderboard data: ${DATA_FILE}`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    server.close();
    await writeQueue;
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

// Only start listening when run directly (not when imported by tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
