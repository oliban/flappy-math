import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createStorage, HIGHSCORES_KEY } from './storage.js';

describe('Storage', () => {
  let mockLocalStorage;
  let storage;

  beforeEach(() => {
    mockLocalStorage = {
      data: {},
      getItem(key) {
        return this.data[key] || null;
      },
      setItem(key, value) {
        this.data[key] = value;
      },
      removeItem(key) {
        delete this.data[key];
      }
    };
    storage = createStorage(mockLocalStorage);
  });

  test('saves progress data', () => {
    const data = { tables: { 2: 3, 5: 1 } };
    storage.save(data);

    expect(mockLocalStorage.data['flappy-math-progress']).toBe(JSON.stringify(data));
  });

  test('loads progress data', () => {
    const data = { tables: { 2: 3, 5: 1 } };
    mockLocalStorage.data['flappy-math-progress'] = JSON.stringify(data);

    const loaded = storage.load();
    expect(loaded).toEqual(data);
  });

  test('returns null when no saved data', () => {
    const loaded = storage.load();
    expect(loaded).toBeNull();
  });

  test('stores different documents under different keys', () => {
    const progress = createStorage(mockLocalStorage);
    const highscores = createStorage(mockLocalStorage, HIGHSCORES_KEY);

    progress.save({ tables: { 2: 1 } });
    highscores.save({ entries: [{ score: 5 }] });

    expect(progress.load()).toEqual({ tables: { 2: 1 } });
    expect(highscores.load()).toEqual({ entries: [{ score: 5 }] });
    expect(mockLocalStorage.data[HIGHSCORES_KEY]).toBeTruthy();
  });

  test('handles corrupted data gracefully', () => {
    mockLocalStorage.data['flappy-math-progress'] = 'not valid json{{{';

    const loaded = storage.load();
    expect(loaded).toBeNull();
  });
});
