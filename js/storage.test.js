import { describe, test, expect, beforeEach, vi } from 'vitest';
import { createStorage } from './storage.js';

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

  test('handles corrupted data gracefully', () => {
    mockLocalStorage.data['flappy-math-progress'] = 'not valid json{{{';

    const loaded = storage.load();
    expect(loaded).toBeNull();
  });
});
