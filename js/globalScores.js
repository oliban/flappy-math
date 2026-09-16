import { MIN_TABLE, MAX_TABLE, MIN_SPEED, MAX_SPEED } from './constants.js';
import { sanitizeName } from './player.js';

export const DEFAULT_TIMEOUT = 6000;
export const UNKNOWN_NAME = '???';

// Entries arrive from a shared server, so nothing is trusted: anything that is
// not a well-formed run is dropped before it can reach the canvas.
function parseServerEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const score = Number(entry.score);
  const table = Number(entry.table);
  const speed = Number(entry.speed);

  if (!Number.isFinite(score) || score < 0) return null;
  if (!Number.isInteger(table) || table < MIN_TABLE || table > MAX_TABLE) return null;
  if (!Number.isFinite(speed) || speed < MIN_SPEED || speed > MAX_SPEED) return null;

  return {
    name: sanitizeName(entry.name) || UNKNOWN_NAME,
    avatar: typeof entry.avatar === 'string' && /^[a-z0-9-]{1,40}$/.test(entry.avatar) ? entry.avatar : '',
    score: Math.round(score),
    table,
    speed: Math.round(speed),
    streak: Math.max(0, Math.round(Number(entry.streak) || 0)),
    date: typeof entry.date === 'string' ? entry.date : ''
  };
}

function parseEntries(body) {
  if (!body || !Array.isArray(body.entries)) return [];
  return body.entries.map(parseServerEntry).filter(Boolean);
}

function classifyError(error) {
  return error && error.name === 'AbortError' ? 'timeout' : 'offline';
}

/**
 * Client for the shared (global) leaderboard. Every call resolves - a missing
 * or failing server degrades the global list to an "offline" message instead of
 * breaking the game.
 */
export function createGlobalScores({
  fetchFn = typeof fetch === 'function' ? fetch.bind(globalThis) : null,
  baseUrl = '/api',
  timeout = DEFAULT_TIMEOUT
} = {}) {
  async function request(path, options = {}) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;

    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
        ...options,
        signal: controller ? controller.signal : undefined
      });

      if (!response || !response.ok) return { ok: false, error: 'server' };

      try {
        return { ok: true, body: await response.json() };
      } catch (e) {
        return { ok: false, error: 'server' };
      }
    } catch (e) {
      return { ok: false, error: classifyError(e) };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    isAvailable() {
      return typeof fetchFn === 'function';
    },

    async fetchTop({ table = null, limit = 10 } = {}) {
      if (!this.isAvailable()) return { ok: false, error: 'unavailable', entries: [] };

      const params = new URLSearchParams({ limit: String(limit) });
      if (table !== null && table !== undefined) params.set('table', String(table));

      const result = await request(`/scores?${params.toString()}`);
      if (!result.ok) return { ok: false, error: result.error, entries: [] };

      return { ok: true, entries: parseEntries(result.body) };
    },

    async submit(entry) {
      if (!this.isAvailable()) return { ok: false, error: 'unavailable' };

      const name = sanitizeName(entry && entry.name);
      if (!name) return { ok: false, error: 'no-name' };

      const payload = {
        name,
        avatar: typeof entry.avatar === 'string' ? entry.avatar : '',
        score: Math.max(0, Math.round(Number(entry.score) || 0)),
        table: Math.round(Number(entry.table) || MIN_TABLE),
        speed: Math.round(Number(entry.speed) || MIN_SPEED),
        streak: Math.max(0, Math.round(Number(entry.streak) || 0))
      };

      const result = await request('/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!result.ok) return { ok: false, error: result.error };

      const rank = Number(result.body && result.body.rank);

      return {
        ok: true,
        rank: Number.isInteger(rank) && rank > 0 ? rank : null,
        entries: parseEntries(result.body)
      };
    }
  };
}
