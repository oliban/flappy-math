import { describe, test, expect, beforeEach } from 'vitest';
import { createProgress } from './progress.js';

describe('Progress', () => {
  let progress;

  beforeEach(() => {
    progress = createProgress();
  });

  test('all tables start at speed 0 (not mastered)', () => {
    for (let table = 2; table <= 12; table++) {
      expect(progress.getBestSpeed(table)).toBe(0);
    }
  });

  test('can update best speed for a table', () => {
    progress.updateBestSpeed(5, 3);
    expect(progress.getBestSpeed(5)).toBe(3);
  });

  test('only updates if new speed is higher', () => {
    progress.updateBestSpeed(5, 3);
    progress.updateBestSpeed(5, 2);
    expect(progress.getBestSpeed(5)).toBe(3);

    progress.updateBestSpeed(5, 4);
    expect(progress.getBestSpeed(5)).toBe(4);
  });

  test('tables are independent', () => {
    progress.updateBestSpeed(3, 5);
    progress.updateBestSpeed(7, 2);

    expect(progress.getBestSpeed(3)).toBe(5);
    expect(progress.getBestSpeed(7)).toBe(2);
    expect(progress.getBestSpeed(4)).toBe(0);
  });

  test('returns all table progress', () => {
    progress.updateBestSpeed(2, 1);
    progress.updateBestSpeed(5, 3);

    const all = progress.getAllProgress();
    expect(all[2]).toBe(1);
    expect(all[5]).toBe(3);
    expect(all[3]).toBe(0);
  });

  test('can export and import progress data', () => {
    progress.updateBestSpeed(3, 4);
    progress.updateBestSpeed(7, 2);

    const data = progress.export();
    const newProgress = createProgress();
    newProgress.import(data);

    expect(newProgress.getBestSpeed(3)).toBe(4);
    expect(newProgress.getBestSpeed(7)).toBe(2);
  });
});
