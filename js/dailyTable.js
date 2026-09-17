// The table of the day.
//
// The table is derived from the calendar date rather than stored or randomised
// at runtime, so it is stable across reloads and identical for every player on
// the same day - which is what makes the shared global list comparable.

import { MIN_TABLE, MAX_TABLE } from './constants.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

// Local date as YYYY-MM-DD, so the table turns over at the player's midnight.
export function getDayKey(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '1970-01-01';

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

// FNV-1a: a small, well-mixed hash so neighbouring dates land far apart.
function hashString(text) {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

export function getDailyTable(dateOrKey = new Date()) {
  const key = typeof dateOrKey === 'string' ? dateOrKey : getDayKey(dateOrKey);
  const span = MAX_TABLE - MIN_TABLE + 1;

  return MIN_TABLE + (hashString(`flappy-math:${key}`) % span);
}

export function msUntilNextTable(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return MS_PER_DAY;

  const nextMidnight = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() + 1,
    0, 0, 0, 0
  );

  return Math.max(1, nextMidnight.getTime() - value.getTime());
}

export function formatTimeUntilNextTable(date = new Date()) {
  const remaining = msUntilNextTable(date);
  const totalMinutes = Math.max(1, Math.ceil(remaining / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
