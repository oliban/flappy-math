// Character unlocks: starters are always available; one new character drops
// per ISO week per device, and beating the highscore can unlock one more per day.
import { getISOWeek } from './weekly.js';

const UNLOCKS_KEY = 'flappy-math-unlocks';
const DEVICE_KEY = 'flappy-math-device';

export function weekKey(date) {
  const week = getISOWeek(date);
  // The ISO week-year can differ from the calendar year around New Year
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Small deterministic string hash (FNV-1a)
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function randomSeed() {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function createUnlocks({ storage = window.localStorage, starterIds, allIds, now = () => new Date() }) {
  let seed;
  let data = { unlocked: [], weeksClaimed: [], lastHighscoreUnlockDay: null };

  function load() {
    seed = storage.getItem(DEVICE_KEY);
    if (!seed) {
      seed = randomSeed();
      try { storage.setItem(DEVICE_KEY, seed); } catch (e) { /* ignore */ }
    }
    try {
      const raw = storage.getItem(UNLOCKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = {
          unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
          weeksClaimed: Array.isArray(parsed.weeksClaimed) ? parsed.weeksClaimed : [],
          lastHighscoreUnlockDay: parsed.lastHighscoreUnlockDay || null
        };
      }
    } catch (e) {
      console.warn('Failed to load unlocks:', e);
    }
  }

  function save() {
    try {
      storage.setItem(UNLOCKS_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save unlocks:', e);
    }
  }

  function unlockedSet() {
    return new Set([...starterIds, ...data.unlocked]);
  }

  function lockedIds() {
    const have = unlockedSet();
    return allIds.filter(id => !have.has(id));
  }

  // Deterministic pick from the locked pool using the device seed + a salt
  function pickLocked(salt) {
    const pool = lockedIds();
    if (pool.length === 0) return null;
    return pool[hash(`${seed}|${salt}`) % pool.length];
  }

  load();

  return {
    isUnlocked(id) {
      return unlockedSet().has(id);
    },

    unlockedIds() {
      return [...unlockedSet()];
    },

    totalCount() {
      return allIds.length;
    },

    // Returns the newly dropped id, or null if this week's drop was already claimed
    claimWeeklyDrop() {
      const key = weekKey(now());
      if (data.weeksClaimed.includes(key)) return null;
      const id = pickLocked(key);
      data.weeksClaimed.push(key);
      if (id) data.unlocked.push(id);
      save();
      return id;
    },

    // Returns the newly unlocked id, or null if one was already earned today
    claimHighscoreUnlock() {
      const day = dayKey(now());
      if (data.lastHighscoreUnlockDay === day) return null;
      const id = pickLocked(`hs|${day}`);
      if (!id) return null;
      data.lastHighscoreUnlockDay = day;
      data.unlocked.push(id);
      save();
      return id;
    }
  };
}
