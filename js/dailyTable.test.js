import { describe, test, expect } from 'vitest';
import {
  getDailyTable,
  getDayKey,
  msUntilNextTable,
  formatTimeUntilNextTable
} from './dailyTable.js';
import { MIN_TABLE, MAX_TABLE } from './constants.js';

describe('getDayKey', () => {
  test('formats a date as YYYY-MM-DD', () => {
    expect(getDayKey(new Date(2026, 8, 17, 13, 45))).toBe('2026-09-17');
  });

  test('pads single digit months and days', () => {
    expect(getDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('uses local time, not UTC, so the table turns over at local midnight', () => {
    const justBeforeMidnight = new Date(2026, 8, 17, 23, 59, 59);
    const justAfterMidnight = new Date(2026, 8, 18, 0, 0, 1);

    expect(getDayKey(justBeforeMidnight)).toBe('2026-09-17');
    expect(getDayKey(justAfterMidnight)).toBe('2026-09-18');
  });
});

describe('getDailyTable', () => {
  test('returns a table inside the playable range', () => {
    for (let day = 1; day <= 60; day++) {
      const table = getDailyTable(new Date(2026, 0, day));

      expect(table).toBeGreaterThanOrEqual(MIN_TABLE);
      expect(table).toBeLessThanOrEqual(MAX_TABLE);
      expect(Number.isInteger(table)).toBe(true);
    }
  });

  test('is the same all day, whatever the time', () => {
    const morning = getDailyTable(new Date(2026, 8, 17, 6, 0));
    const evening = getDailyTable(new Date(2026, 8, 17, 23, 30));

    expect(morning).toBe(evening);
  });

  test('is stable across calls, so reloading does not reroll it', () => {
    const date = new Date(2026, 8, 17);

    expect(getDailyTable(date)).toBe(getDailyTable(date));
  });

  test('changes from one day to the next', () => {
    // Not every consecutive pair has to differ, but a month of the same table
    // would mean the seeding is broken.
    const tables = [];
    for (let day = 1; day <= 30; day++) {
      tables.push(getDailyTable(new Date(2026, 3, day)));
    }

    expect(new Set(tables).size).toBeGreaterThan(5);
  });

  test('reaches every table over a long enough stretch', () => {
    const seen = new Set();
    for (let day = 0; day < 400; day++) {
      seen.add(getDailyTable(new Date(2026, 0, 1 + day)));
    }

    expect(seen.size).toBe(MAX_TABLE - MIN_TABLE + 1);
  });

  test('spreads reasonably evenly rather than favouring one table', () => {
    const counts = new Map();
    const days = 1200;

    for (let day = 0; day < days; day++) {
      const table = getDailyTable(new Date(2026, 0, 1 + day));
      counts.set(table, (counts.get(table) || 0) + 1);
    }

    const expected = days / (MAX_TABLE - MIN_TABLE + 1);
    counts.forEach(count => {
      expect(count).toBeGreaterThan(expected * 0.4);
      expect(count).toBeLessThan(expected * 1.6);
    });
  });

  test('accepts a day key string as well as a date', () => {
    expect(getDailyTable('2026-09-17')).toBe(getDailyTable(new Date(2026, 8, 17)));
  });

  test('falls back to a valid table for unusable input', () => {
    const table = getDailyTable(new Date('nonsense'));

    expect(table).toBeGreaterThanOrEqual(MIN_TABLE);
    expect(table).toBeLessThanOrEqual(MAX_TABLE);
  });
});

describe('msUntilNextTable', () => {
  test('counts down to local midnight', () => {
    const at2230 = msUntilNextTable(new Date(2026, 8, 17, 22, 30, 0));

    expect(at2230).toBe(90 * 60 * 1000);
  });

  test('is a full day just after midnight', () => {
    const justAfter = msUntilNextTable(new Date(2026, 8, 17, 0, 0, 0));

    expect(justAfter).toBe(24 * 60 * 60 * 1000);
  });

  test('is never negative', () => {
    expect(msUntilNextTable(new Date(2026, 8, 17, 23, 59, 59, 999))).toBeGreaterThan(0);
  });
});

describe('formatTimeUntilNextTable', () => {
  test('shows hours and minutes when hours remain', () => {
    expect(formatTimeUntilNextTable(new Date(2026, 8, 17, 21, 30))).toBe('2h 30m');
  });

  test('shows only minutes in the last hour', () => {
    expect(formatTimeUntilNextTable(new Date(2026, 8, 17, 23, 15))).toBe('45m');
  });

  test('never shows zero minutes', () => {
    expect(formatTimeUntilNextTable(new Date(2026, 8, 17, 23, 59, 30))).toBe('1m');
  });
});
