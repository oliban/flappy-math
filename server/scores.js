// Global leaderboard store. Pure data logic - no I/O, no HTTP - so it can be
// unit tested and reused by the request handlers in server.js.

import { MIN_TABLE, MAX_TABLE, MIN_SPEED, MAX_SPEED } from '../js/constants.js';
import { sanitizeName } from '../js/player.js';

// Per-table cap keeps the saved file small and bounded no matter how much is submitted.
export const MAX_ENTRIES_PER_TABLE = 50;
export const MAX_SCORE = 100000;
export const MAX_STREAK = 10000;

// Avatar ids are kebab-case slugs from js/avatars.js; anything else is dropped (never rejected)
const AVATAR_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export function sanitizeAvatar(value) {
  return typeof value === 'string' && AVATAR_ID.test(value) ? value : '';
}

// Best first: higher score, then higher speed, then whoever got there first.
function compareEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.speed !== a.speed) return b.speed - a.speed;
  return String(a.date).localeCompare(String(b.date));
}

export function createEmptyStore() {
  return { version: 1, tables: {} };
}

function invalid(error) {
  return { valid: false, error };
}

/**
 * Validates a submission from the network. The date is always assigned by the
 * server, and unknown fields are dropped.
 */
export function validateEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid('invalid-body');

  const name = sanitizeName(raw.name);
  if (!name) return invalid('invalid-name');

  const table = Number(raw.table);
  if (!Number.isInteger(table) || table < MIN_TABLE || table > MAX_TABLE) return invalid('invalid-table');

  const speed = Number(raw.speed);
  if (!Number.isInteger(speed) || speed < MIN_SPEED || speed > MAX_SPEED) return invalid('invalid-speed');

  const score = Number(raw.score);
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return invalid('invalid-score');

  const rawStreak = raw.streak === undefined || raw.streak === null ? 0 : Number(raw.streak);
  if (!Number.isInteger(rawStreak) || rawStreak < 0 || rawStreak > MAX_STREAK) return invalid('invalid-streak');

  return {
    valid: true,
    entry: {
      name,
      avatar: sanitizeAvatar(raw.avatar),
      score,
      table,
      speed,
      streak: rawStreak,
      date: new Date().toISOString()
    }
  };
}

function allEntries(store) {
  return Object.values(store.tables).flat();
}

/**
 * Adds an entry to the store, keeping one (best) run per player per table.
 * Returns the ranks of the run that was kept, or null ranks when the score did
 * not make the capped list.
 */
export function insertEntry(store, entry) {
  const key = String(entry.table);
  const bucket = [...(store.tables[key] || [])];
  const nameKey = entry.name.toLowerCase();
  const existingIndex = bucket.findIndex(e => e.name.toLowerCase() === nameKey);

  let kept = entry;
  if (existingIndex === -1) {
    bucket.push(entry);
  } else if (compareEntries(entry, bucket[existingIndex]) < 0) {
    // The new run is better - it replaces the player's previous one.
    bucket.splice(existingIndex, 1, entry);
  } else {
    // The player already has a better run; keep it and report its rank.
    kept = bucket[existingIndex];
  }

  bucket.sort(compareEntries);
  store.tables[key] = bucket.slice(0, MAX_ENTRIES_PER_TABLE);

  const tableIndex = store.tables[key].indexOf(kept);
  if (tableIndex === -1) {
    return { rank: null, tableRank: null };
  }

  const overallIndex = allEntries(store).sort(compareEntries).indexOf(kept);

  return {
    rank: overallIndex === -1 ? null : overallIndex + 1,
    tableRank: tableIndex + 1
  };
}

export function topEntries(store, { table = null, limit = 10 } = {}) {
  const source = table === null || table === undefined
    ? allEntries(store)
    : [...(store.tables[String(table)] || [])];

  return source
    .sort(compareEntries)
    .slice(0, Math.max(0, limit))
    .map(e => ({ ...e }));
}

function parseStoredEntry(entry, expectedTable) {
  if (!entry || typeof entry !== 'object') return null;

  const name = sanitizeName(entry.name);
  const score = Number(entry.score);
  const table = Number(entry.table);
  const speed = Number(entry.speed);
  const streak = Number(entry.streak) || 0;

  if (!name) return null;
  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) return null;
  if (!Number.isInteger(table) || table < MIN_TABLE || table > MAX_TABLE) return null;
  if (table !== expectedTable) return null;
  if (!Number.isInteger(speed) || speed < MIN_SPEED || speed > MAX_SPEED) return null;

  return {
    name,
    avatar: sanitizeAvatar(entry.avatar),
    score,
    table,
    speed,
    streak: Number.isInteger(streak) && streak >= 0 ? streak : 0,
    date: typeof entry.date === 'string' ? entry.date : new Date(0).toISOString()
  };
}

// Rebuilds a store from whatever is on disk, discarding anything malformed.
export function parseStore(data) {
  const store = createEmptyStore();
  if (!data || typeof data !== 'object' || !data.tables || typeof data.tables !== 'object') {
    return store;
  }

  Object.entries(data.tables).forEach(([key, list]) => {
    const table = Number(key);
    if (!Number.isInteger(table) || table < MIN_TABLE || table > MAX_TABLE) return;
    if (!Array.isArray(list)) return;

    const entries = list
      .map(entry => parseStoredEntry(entry, table))
      .filter(Boolean)
      .sort(compareEntries)
      .slice(0, MAX_ENTRIES_PER_TABLE);

    if (entries.length > 0) store.tables[key] = entries;
  });

  return store;
}
