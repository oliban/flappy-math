// Weekly challenge: the multiplication table rotates with the ISO week number.

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
