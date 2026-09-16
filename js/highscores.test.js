import { describe, test, expect, beforeEach } from 'vitest';
import { createHighscores, MAX_LOCAL_ENTRIES } from './highscores.js';

function entry(score, overrides = {}) {
  return { score, table: 2, speed: 1, streak: score, name: 'Ada', ...overrides };
}

describe('Highscores', () => {
  let highscores;

  beforeEach(() => {
    highscores = createHighscores();
  });

  describe('adding scores', () => {
    test('first score is ranked first', () => {
      const result = highscores.add(entry(5));

      expect(result.rank).toBe(1);
      expect(result.isTopScore).toBe(true);
      expect(highscores.getTop()).toHaveLength(1);
    });

    test('ranks higher scores above lower ones', () => {
      highscores.add(entry(5));
      highscores.add(entry(12));
      highscores.add(entry(8));

      expect(highscores.getTop().map(e => e.score)).toEqual([12, 8, 5]);
    });

    test('breaks score ties by higher speed', () => {
      highscores.add(entry(10, { speed: 1 }));
      const result = highscores.add(entry(10, { speed: 4 }));

      expect(result.rank).toBe(1);
      expect(highscores.getTop().map(e => e.speed)).toEqual([4, 1]);
    });

    test('keeps the earlier entry first when score and speed tie', () => {
      highscores.add(entry(10, { name: 'First', date: '2026-01-01T00:00:00.000Z' }));
      const result = highscores.add(entry(10, { name: 'Second', date: '2026-01-02T00:00:00.000Z' }));

      expect(result.rank).toBe(2);
      expect(highscores.getTop()[0].name).toBe('First');
    });

    test('stamps entries with a date when none is given', () => {
      highscores.add(entry(3));

      expect(highscores.getTop()[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test(`keeps at most ${MAX_LOCAL_ENTRIES} entries`, () => {
      for (let i = 1; i <= MAX_LOCAL_ENTRIES + 5; i++) {
        highscores.add(entry(i));
      }

      const all = highscores.getTop(100);
      expect(all).toHaveLength(MAX_LOCAL_ENTRIES);
      expect(all[0].score).toBe(MAX_LOCAL_ENTRIES + 5);
      expect(all[all.length - 1].score).toBe(6);
    });

    test('reports no rank for a score that does not make the list', () => {
      for (let i = 100; i < 100 + MAX_LOCAL_ENTRIES; i++) {
        highscores.add(entry(i));
      }

      const result = highscores.add(entry(1));

      expect(result.rank).toBeNull();
      expect(highscores.getTop(100)).toHaveLength(MAX_LOCAL_ENTRIES);
    });
  });

  describe('personal bests', () => {
    test('first non-zero score for a table is a personal best', () => {
      const result = highscores.add(entry(4, { table: 7 }));

      expect(result.isPersonalBest).toBe(true);
      expect(result.previousBest).toBe(0);
    });

    test('a score of zero is never a personal best', () => {
      const result = highscores.add(entry(0));

      expect(result.isPersonalBest).toBe(false);
    });

    test('beating the previous best for the table is a personal best', () => {
      highscores.add(entry(6, { table: 7 }));
      const result = highscores.add(entry(9, { table: 7 }));

      expect(result.isPersonalBest).toBe(true);
      expect(result.previousBest).toBe(6);
    });

    test('matching the previous best is not a personal best', () => {
      highscores.add(entry(6, { table: 7 }));
      const result = highscores.add(entry(6, { table: 7 }));

      expect(result.isPersonalBest).toBe(false);
    });

    test('personal bests are tracked per table', () => {
      highscores.add(entry(20, { table: 3 }));
      const result = highscores.add(entry(5, { table: 8 }));

      expect(result.isPersonalBest).toBe(true);
      expect(highscores.getBestScore(3)).toBe(20);
      expect(highscores.getBestScore(8)).toBe(5);
      expect(highscores.getBestScore(11)).toBe(0);
    });

    test('a table best survives being pushed off the overall list', () => {
      highscores.add(entry(4, { table: 9 }));
      for (let i = 100; i < 100 + MAX_LOCAL_ENTRIES; i++) {
        highscores.add(entry(i, { table: 2 }));
      }

      expect(highscores.getTop(100).some(e => e.table === 9)).toBe(false);
      expect(highscores.getBestScore(9)).toBe(4);
    });

    test('getPersonalBest returns the full entry for a table', () => {
      highscores.add(entry(6, { table: 5, speed: 2 }));
      highscores.add(entry(11, { table: 5, speed: 3 }));

      expect(highscores.getPersonalBest(5)).toMatchObject({ score: 11, speed: 3 });
      expect(highscores.getPersonalBest(6)).toBeNull();
    });
  });

  describe('filtering and reading', () => {
    test('getTop limits the number of entries returned', () => {
      [3, 9, 6, 12].forEach(s => highscores.add(entry(s)));

      expect(highscores.getTop(2).map(e => e.score)).toEqual([12, 9]);
    });

    test('getForTable only returns entries for that table', () => {
      highscores.add(entry(8, { table: 4 }));
      highscores.add(entry(15, { table: 6 }));
      highscores.add(entry(3, { table: 4 }));

      expect(highscores.getForTable(4).map(e => e.score)).toEqual([8, 3]);
    });

    test('returned lists are copies, not internal state', () => {
      highscores.add(entry(5));
      const top = highscores.getTop();
      top[0].score = 999;

      expect(highscores.getTop()[0].score).toBe(5);
    });

    test('isEmpty reflects whether any score was recorded', () => {
      expect(highscores.isEmpty()).toBe(true);
      highscores.add(entry(1));
      expect(highscores.isEmpty()).toBe(false);
    });

    test('clear removes entries and table bests', () => {
      highscores.add(entry(7, { table: 4 }));
      highscores.clear();

      expect(highscores.isEmpty()).toBe(true);
      expect(highscores.getBestScore(4)).toBe(0);
    });
  });

  describe('persistence', () => {
    test('exports and re-imports entries and table bests', () => {
      highscores.add(entry(7, { table: 4 }));
      highscores.add(entry(11, { table: 6 }));

      const restored = createHighscores();
      restored.import(highscores.export());

      expect(restored.getTop().map(e => e.score)).toEqual([11, 7]);
      expect(restored.getBestScore(4)).toBe(7);
    });

    test('ignores missing or malformed data', () => {
      highscores.import(null);
      highscores.import({ entries: 'nope' });
      highscores.import({ entries: [{ score: 'x' }, null, { score: 5, table: 99 }] });

      expect(highscores.isEmpty()).toBe(true);
    });

    test('rebuilds table bests from imported entries when they are missing', () => {
      highscores.import({ entries: [{ score: 9, table: 3, speed: 2, name: 'Ada' }] });

      expect(highscores.getBestScore(3)).toBe(9);
    });

    test('sorts and caps imported entries', () => {
      const entries = [];
      for (let i = 1; i <= MAX_LOCAL_ENTRIES + 3; i++) {
        entries.push({ score: i, table: 2, speed: 1, name: 'Ada' });
      }
      highscores.import({ entries });

      const all = highscores.getTop(100);
      expect(all).toHaveLength(MAX_LOCAL_ENTRIES);
      expect(all[0].score).toBe(MAX_LOCAL_ENTRIES + 3);
    });
  });
});
