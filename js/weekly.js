// Challenge tables: a table of the day (main mode) plus ISO-week helpers
// (still used for the weekly character drop).

const MIN_TABLE = 2;
const MAX_TABLE = 12;
const TABLE_COUNT = MAX_TABLE - MIN_TABLE + 1;

export function getISOWeek(date = new Date()) {
  // Work in UTC to avoid DST edge cases
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO weeks start on Monday; shift so Thursday decides the week's year
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function getWeeklyTable(date = new Date()) {
  const week = getISOWeek(date);
  return MIN_TABLE + ((week - 1) % TABLE_COUNT);
}

// Whole days until the table changes (ISO weeks start on Monday). 1..7
export function daysUntilNextTable(date = new Date()) {
  const day = date.getDay() || 7; // Monday = 1 ... Sunday = 7
  return 8 - day;
}

// Table of the day, derived from the local calendar date so every player gets
// the same table and a reload cannot reroll it. Consecutive days always differ:
// 7 is a generator mod 11, and the block offset keeps the step at 7 or 10.
export function getDailyTable(date = new Date()) {
  const n = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const idx = (7 * n + 3 * Math.floor(n / TABLE_COUNT)) % TABLE_COUNT;
  return MIN_TABLE + ((idx % TABLE_COUNT) + TABLE_COUNT) % TABLE_COUNT;
}

export function msUntilNextDay(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return Math.max(1, next.getTime() - date.getTime());
}

export function formatTimeUntilNextDay(date = new Date()) {
  const totalMinutes = Math.max(1, Math.ceil(msUntilNextDay(date) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
