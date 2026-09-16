import { describe, test, expect, beforeEach } from 'vitest';
import { createHighscores, MAX_ENTRIES, formatEntryDate } from './highscores.js';

function mockStorage() {
  const data = {};
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}

const entry = (name, score, extra = {}) => ({
  name, score, avatar: 'bird', table: 7, maxSpeed: score, ...extra
});

describe('highscores', () => {
  let storage;
  beforeEach(() => { storage = mockStorage(); });

  test('starts empty', () => {
    expect(createHighscores(storage).list()).toEqual([]);
  });

  test('add returns the 1-based rank of the new entry', () => {
    const hs = createHighscores(storage);
    expect(hs.add(entry('A', 5))).toBe(1);
    expect(hs.add(entry('B', 9))).toBe(1);
    expect(hs.add(entry('C', 7))).toBe(2);
  });

  test('list is sorted by score descending', () => {
    const hs = createHighscores(storage);
    hs.add(entry('A', 3));
    hs.add(entry('B', 8));
    hs.add(entry('C', 5));
    expect(hs.list().map(e => e.name)).toEqual(['B', 'C', 'A']);
  });

  test('earlier entry wins ties', () => {
    const hs = createHighscores(storage);
    hs.add(entry('First', 5));
    hs.add(entry('Second', 5));
    expect(hs.list().map(e => e.name)).toEqual(['First', 'Second']);
  });

  test('keeps only the top MAX_ENTRIES and returns null when not placing', () => {
    const hs = createHighscores(storage);
    for (let i = 1; i <= MAX_ENTRIES; i++) hs.add(entry(`P${i}`, i + 10));
    expect(hs.add(entry('Loser', 1))).toBeNull();
    expect(hs.list().length).toBe(MAX_ENTRIES);
    expect(hs.list().some(e => e.name === 'Loser')).toBe(false);
  });

  test('zero scores are not recorded', () => {
    const hs = createHighscores(storage);
    expect(hs.add(entry('Zero', 0))).toBeNull();
    expect(hs.list()).toEqual([]);
  });

  test('stamps each entry with a date', () => {
    const hs = createHighscores(storage);
    hs.add(entry('A', 4));
    expect(typeof hs.list()[0].date).toBe('string');
  });

  test('persists across instances', () => {
    createHighscores(storage).add(entry('Saved', 6));
    expect(createHighscores(storage).list()[0].name).toBe('Saved');
  });

  test('survives corrupted storage', () => {
    storage.setItem('flappy-math-highscores', '[broken');
    expect(createHighscores(storage).list()).toEqual([]);
  });
});

describe('highscore date formatting', () => {
  test('shows day, month and time', () => {
    const d = new Date(2026, 8, 16, 14, 5);
    const text = formatEntryDate(d.toISOString(), 'en-GB');
    expect(text).toMatch(/16/);
    expect(text).toMatch(/Sep/i);
    expect(text).toMatch(/14:05/);
  });

  test('returns empty string for missing or invalid dates', () => {
    expect(formatEntryDate(undefined, 'en-GB')).toBe('');
    expect(formatEntryDate('not a date', 'en-GB')).toBe('');
  });
});
