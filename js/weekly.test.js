import { describe, test, expect } from 'vitest';
import { getISOWeek, getWeeklyTable, daysUntilNextTable, getDailyTable, formatTimeUntilNextDay } from './weekly.js';

describe('ISO week number', () => {
  test('Jan 1 2026 (Thursday) is week 1', () => {
    expect(getISOWeek(new Date(2026, 0, 1))).toBe(1);
  });

  test('Sep 16 2026 is week 38', () => {
    expect(getISOWeek(new Date(2026, 8, 16))).toBe(38);
  });

  test('Dec 31 2024 belongs to week 1 of 2025', () => {
    expect(getISOWeek(new Date(2024, 11, 31))).toBe(1);
  });

  test('Jan 1 2021 (Friday) belongs to week 53 of 2020', () => {
    expect(getISOWeek(new Date(2021, 0, 1))).toBe(53);
  });
});

describe('weekly table', () => {
  test('week 1 maps to table 2', () => {
    expect(getWeeklyTable(new Date(2026, 0, 1))).toBe(2);
  });

  test('week 11 maps to table 12', () => {
    expect(getWeeklyTable(new Date(2026, 2, 12))).toBe(12);
  });

  test('week 12 wraps back to table 2', () => {
    expect(getWeeklyTable(new Date(2026, 2, 19))).toBe(2);
  });

  test('always yields a table between 2 and 12', () => {
    for (let day = 0; day < 400; day++) {
      const d = new Date(2025, 0, 1 + day);
      const table = getWeeklyTable(d);
      expect(table).toBeGreaterThanOrEqual(2);
      expect(table).toBeLessThanOrEqual(12);
    }
  });
});

describe('time until the next weekly table', () => {
  test('counts whole days left in the ISO week (Monday rollover)', () => {
    // Wednesday 2026-09-16 -> next Monday is 2026-09-21
    expect(daysUntilNextTable(new Date(2026, 8, 16, 10))).toBe(5);
    // Sunday evening -> 1 day
    expect(daysUntilNextTable(new Date(2026, 8, 20, 22))).toBe(1);
    // Monday morning -> a full week
    expect(daysUntilNextTable(new Date(2026, 8, 21, 8))).toBe(7);
  });
});

describe('daily table', () => {
  test('is stable for a whole day and lies within 2..12', () => {
    const morning = getDailyTable(new Date(2026, 8, 17, 6));
    const night = getDailyTable(new Date(2026, 8, 17, 23, 59));
    expect(morning).toBe(night);
    expect(morning).toBeGreaterThanOrEqual(2);
    expect(morning).toBeLessThanOrEqual(12);
  });

  test('changes between days often enough to feel fresh', () => {
    const seen = new Set();
    for (let d = 0; d < 30; d++) seen.add(getDailyTable(new Date(2026, 8, 1 + d)));
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  test('never repeats the same table two days in a row', () => {
    for (let d = 0; d < 400; d++) {
      const a = getDailyTable(new Date(2026, 0, 1 + d));
      const b = getDailyTable(new Date(2026, 0, 2 + d));
      expect(a).not.toBe(b);
    }
  });

  test('formats the time until midnight as hours and minutes', () => {
    expect(formatTimeUntilNextDay(new Date(2026, 8, 17, 18, 30))).toBe('5h 30m');
    expect(formatTimeUntilNextDay(new Date(2026, 8, 17, 23, 41))).toBe('19m');
  });
});
