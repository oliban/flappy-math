import { describe, test, expect } from 'vitest';
import {
  createEmptyStore,
  validateEntry,
  insertEntry,
  topEntries,
  parseStore,
  MAX_ENTRIES_PER_TABLE
} from './scores.js';

function run(overrides = {}) {
  return { name: 'Ada', score: 10, table: 4, speed: 2, streak: 5, ...overrides };
}

describe('validateEntry', () => {
  test('accepts a well-formed run', () => {
    const result = validateEntry(run());

    expect(result.valid).toBe(true);
    expect(result.entry).toMatchObject({ name: 'Ada', score: 10, table: 4, speed: 2, streak: 5 });
  });

  test('stamps the entry with a server-side date', () => {
    const result = validateEntry(run({ date: '1999-01-01T00:00:00.000Z' }));

    expect(result.entry.date).not.toBe('1999-01-01T00:00:00.000Z');
    expect(Date.parse(result.entry.date)).toBeGreaterThan(0);
  });

  test('sanitizes the name', () => {
    const result = validateEntry(run({ name: '  Ada   Lovelace  ' }));

    expect(result.entry.name).toBe('Ada Lovelace');
  });

  test('rejects a blank name', () => {
    expect(validateEntry(run({ name: '   ' }))).toMatchObject({ valid: false, error: 'invalid-name' });
  });

  test('rejects a non-object body', () => {
    expect(validateEntry(null).valid).toBe(false);
    expect(validateEntry('hello').valid).toBe(false);
  });

  test('rejects an out-of-range table', () => {
    expect(validateEntry(run({ table: 0 })).error).toBe('invalid-table');
    expect(validateEntry(run({ table: 13 })).error).toBe('invalid-table');
    expect(validateEntry(run({ table: 'four' })).error).toBe('invalid-table');
  });

  test('accepts the whole playable range, including the 1x table', () => {
    for (let table = 1; table <= 12; table++) {
      expect(validateEntry(run({ table })).valid).toBe(true);
    }
  });

  test('rejects an out-of-range speed', () => {
    expect(validateEntry(run({ speed: 0 })).error).toBe('invalid-speed');
    expect(validateEntry(run({ speed: 100 })).error).toBe('invalid-speed');
  });

  test('rejects a negative or absurd score', () => {
    expect(validateEntry(run({ score: -1 })).error).toBe('invalid-score');
    expect(validateEntry(run({ score: 10 ** 9 })).error).toBe('invalid-score');
    expect(validateEntry(run({ score: 1.5 })).error).toBe('invalid-score');
  });

  test('defaults a missing streak to zero', () => {
    expect(validateEntry(run({ streak: undefined })).entry.streak).toBe(0);
  });

  test('ignores extra fields', () => {
    const result = validateEntry(run({ admin: true, lives: 999 }));

    expect(result.entry.admin).toBeUndefined();
    expect(Object.keys(result.entry).sort()).toEqual(['avatar', 'date', 'name', 'score', 'speed', 'streak', 'table']);
  });
});

describe('insertEntry', () => {
  test('records the first score with rank 1', () => {
    const { rank, tableRank } = insertEntry(createEmptyStore(), validateEntry(run()).entry);

    expect(rank).toBe(1);
    expect(tableRank).toBe(1);
  });

  test('ranks higher scores above lower ones within a table', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run({ name: 'Ada', score: 20 })).entry);
    const result = insertEntry(store, validateEntry(run({ name: 'Bob', score: 12 })).entry);

    expect(result.tableRank).toBe(2);
    expect(topEntries(store, { table: 4 }).map(e => e.name)).toEqual(['Ada', 'Bob']);
  });

  test('keeps only a player best run per table', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run({ name: 'Ada', score: 20 })).entry);
    insertEntry(store, validateEntry(run({ name: 'Ada', score: 8 })).entry);

    const entries = topEntries(store, { table: 4 });
    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBe(20);
  });

  test('replaces a player entry when they beat their own run', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run({ name: 'Ada', score: 8 })).entry);
    const result = insertEntry(store, validateEntry(run({ name: 'Ada', score: 25 })).entry);

    const entries = topEntries(store, { table: 4 });
    expect(entries).toHaveLength(1);
    expect(entries[0].score).toBe(25);
    expect(result.tableRank).toBe(1);
  });

  test('treats names case-insensitively when de-duplicating', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run({ name: 'Ada', score: 8 })).entry);
    insertEntry(store, validateEntry(run({ name: 'ADA', score: 30 })).entry);

    expect(topEntries(store, { table: 4 })).toHaveLength(1);
  });

  test('keeps tables separate', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run({ table: 4, score: 30 })).entry);
    const result = insertEntry(store, validateEntry(run({ table: 9, score: 5, name: 'Bob' })).entry);

    expect(result.tableRank).toBe(1);
    expect(topEntries(store, { table: 9 })).toHaveLength(1);
    expect(topEntries(store, { table: 4 })).toHaveLength(1);
  });

  test('reports the overall rank across all tables', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run({ name: 'Ada', table: 4, score: 30 })).entry);
    const result = insertEntry(store, validateEntry(run({ name: 'Bob', table: 9, score: 12 })).entry);

    expect(result.rank).toBe(2);
    expect(result.tableRank).toBe(1);
  });

  test(`caps a table at ${MAX_ENTRIES_PER_TABLE} entries`, () => {
    const store = createEmptyStore();
    for (let i = 1; i <= MAX_ENTRIES_PER_TABLE + 10; i++) {
      insertEntry(store, validateEntry(run({ name: `P${i}`, score: i })).entry);
    }

    const entries = topEntries(store, { table: 4, limit: 1000 });
    expect(entries).toHaveLength(MAX_ENTRIES_PER_TABLE);
    expect(entries[0].score).toBe(MAX_ENTRIES_PER_TABLE + 10);
  });

  test('reports no rank for a score that misses the capped list', () => {
    const store = createEmptyStore();
    for (let i = 1; i <= MAX_ENTRIES_PER_TABLE; i++) {
      insertEntry(store, validateEntry(run({ name: `P${i}`, score: 100 + i })).entry);
    }

    const result = insertEntry(store, validateEntry(run({ name: 'Late', score: 1 })).entry);
    expect(result.tableRank).toBeNull();
  });
});

describe('topEntries', () => {
  test('merges all tables when no table is given', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run({ name: 'Ada', table: 4, score: 10 })).entry);
    insertEntry(store, validateEntry(run({ name: 'Bob', table: 9, score: 30 })).entry);

    expect(topEntries(store).map(e => e.name)).toEqual(['Bob', 'Ada']);
  });

  test('applies the limit', () => {
    const store = createEmptyStore();
    [5, 20, 15].forEach((score, i) => {
      insertEntry(store, validateEntry(run({ name: `P${i}`, score })).entry);
    });

    expect(topEntries(store, { limit: 2 }).map(e => e.score)).toEqual([20, 15]);
  });

  test('returns an empty list for an unused table', () => {
    expect(topEntries(createEmptyStore(), { table: 11 })).toEqual([]);
  });

  test('returns copies, not internal state', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run()).entry);

    topEntries(store)[0].score = 9999;
    expect(topEntries(store)[0].score).toBe(10);
  });
});

describe('parseStore', () => {
  test('round-trips a saved store', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run()).entry);

    const restored = parseStore(JSON.parse(JSON.stringify(store)));
    expect(topEntries(restored, { table: 4 })).toHaveLength(1);
  });

  test('returns an empty store for junk data', () => {
    expect(topEntries(parseStore(null))).toEqual([]);
    expect(topEntries(parseStore('broken'))).toEqual([]);
    expect(topEntries(parseStore({ tables: 'nope' }))).toEqual([]);
  });

  test('drops invalid entries from a saved store', () => {
    const restored = parseStore({
      tables: {
        4: [{ name: 'Ada', score: 10, table: 4, speed: 2, streak: 1, date: '2026-01-01T00:00:00.000Z' }, { name: '', score: 'x' }],
        99: [{ name: 'Ghost', score: 10, table: 99, speed: 1, streak: 0, date: '2026-01-01T00:00:00.000Z' }]
      }
    });

    expect(topEntries(restored)).toHaveLength(1);
    expect(topEntries(restored)[0].name).toBe('Ada');
  });
});

describe('avatar field', () => {
  test('keeps a well-formed avatar id', () => {
    const result = validateEntry(run({ avatar: 'sir-pounce-42' }));
    expect(result.valid).toBe(true);
    expect(result.entry.avatar).toBe('sir-pounce-42');
  });

  test('drops malformed avatars instead of rejecting the run', () => {
    expect(validateEntry(run({ avatar: '<script>' })).entry.avatar).toBe('');
    expect(validateEntry(run({ avatar: 'x'.repeat(80) })).entry.avatar).toBe('');
    expect(validateEntry(run({})).entry.avatar).toBe('');
  });

  test('avatar survives a round trip through the stored file', () => {
    const store = createEmptyStore();
    insertEntry(store, validateEntry(run({ avatar: 'fox' })).entry);
    const reloaded = parseStore(JSON.parse(JSON.stringify(store)));
    expect(topEntries(reloaded)[0].avatar).toBe('fox');
  });
});
