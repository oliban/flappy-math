import { MIN_TABLE, MAX_TABLE, MIN_SPEED, MAX_SPEED } from './constants.js';
import { sanitizeName } from './player.js';

// How many runs the local list remembers.
export const MAX_LOCAL_ENTRIES = 20;

// Best first: higher score, then higher speed, then whoever got there first.
function compareEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (b.speed !== a.speed) return b.speed - a.speed;
  return String(a.date).localeCompare(String(b.date));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Coerces anything into a storable entry - used when recording a finished run.
function normalize(entry) {
  const raw = entry || {};

  return {
    score: Math.max(0, Math.round(Number(raw.score) || 0)),
    table: clamp(Math.round(Number(raw.table) || MIN_TABLE), MIN_TABLE, MAX_TABLE),
    speed: clamp(Math.round(Number(raw.speed) || MIN_SPEED), MIN_SPEED, MAX_SPEED),
    streak: Math.max(0, Math.round(Number(raw.streak) || 0)),
    name: sanitizeName(raw.name),
    date: typeof raw.date === 'string' ? raw.date : new Date().toISOString()
  };
}

// Stricter check for data coming back from storage - bad entries are dropped
// rather than clamped, so a corrupted file cannot invent plausible scores.
function parseStoredEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const score = Number(entry.score);
  const table = Number(entry.table);
  const speed = Number(entry.speed);

  if (!Number.isFinite(score) || score < 0) return null;
  if (!Number.isInteger(table) || table < MIN_TABLE || table > MAX_TABLE) return null;
  if (!Number.isFinite(speed) || speed < MIN_SPEED || speed > MAX_SPEED) return null;

  return normalize(entry);
}

export function createHighscores() {
  let entries = [];
  // Best run per table, kept separately so a personal best is never forgotten
  // when it drops off the overall top list.
  let tableBests = {};

  function rememberTableBest(entry) {
    const current = tableBests[entry.table];
    if (!current || entry.score > current.score) {
      tableBests[entry.table] = { ...entry };
    }
  }

  return {
    // Records a finished run and reports what it was worth.
    add(entry) {
      const normalized = normalize(entry);
      const previousBest = this.getBestScore(normalized.table);
      const isPersonalBest = normalized.score > 0 && normalized.score > previousBest;

      rememberTableBest(normalized);

      entries.push(normalized);
      entries.sort(compareEntries);
      const index = entries.indexOf(normalized);
      entries = entries.slice(0, MAX_LOCAL_ENTRIES);

      const madeTheList = index < MAX_LOCAL_ENTRIES;

      return {
        rank: madeTheList ? index + 1 : null,
        isTopScore: index === 0 && normalized.score > 0,
        isPersonalBest,
        previousBest
      };
    },

    getTop(limit = 10) {
      return entries.slice(0, limit).map(e => ({ ...e }));
    },

    getForTable(table, limit = 10) {
      return entries
        .filter(e => e.table === table)
        .slice(0, limit)
        .map(e => ({ ...e }));
    },

    getPersonalBest(table) {
      const best = tableBests[table];
      return best ? { ...best } : null;
    },

    getBestScore(table) {
      const best = tableBests[table];
      return best ? best.score : 0;
    },

    isEmpty() {
      return entries.length === 0;
    },

    clear() {
      entries = [];
      tableBests = {};
    },

    export() {
      return {
        entries: entries.map(e => ({ ...e })),
        tableBests: Object.fromEntries(
          Object.entries(tableBests).map(([table, best]) => [table, { ...best }])
        )
      };
    },

    import(data) {
      if (!data || typeof data !== 'object') return;

      if (Array.isArray(data.entries)) {
        entries = data.entries
          .map(parseStoredEntry)
          .filter(Boolean)
          .sort(compareEntries)
          .slice(0, MAX_LOCAL_ENTRIES);
      }

      // Table bests are rebuilt from the entries first so an older save (or one
      // with a missing/corrupt tableBests block) still yields personal bests.
      tableBests = {};
      entries.forEach(rememberTableBest);

      if (data.tableBests && typeof data.tableBests === 'object') {
        Object.values(data.tableBests).forEach(best => {
          const parsed = parseStoredEntry(best);
          if (parsed) rememberTableBest(parsed);
        });
      }
    }
  };
}
