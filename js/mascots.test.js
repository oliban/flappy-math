import { describe, test, expect } from 'vitest';
import { TABLE_MASCOTS, getTableMascot } from './mascots.js';
import { getAvatar } from './avatars.js';

describe('table mascots', () => {
  test('every table 1-12 has a mascot with a body type and a memory hook', () => {
    for (let table = 1; table <= 12; table++) {
      const m = getTableMascot(table);
      expect(m.base, `table ${table}`).toBeTruthy();
      expect(m.hook.en.length, `table ${table}`).toBeGreaterThan(3);
      expect(m.hook.sv.length, `table ${table}`).toBeGreaterThan(3);
    }
  });

  test('the number-themed mascots are what a child would expect', () => {
    expect(getTableMascot(5).base).toBe('star');     // five points
    expect(getTableMascot(8).base).toBe('octopus');  // eight arms
    expect(getTableMascot(6).base).toBe('bug');      // six legs
    expect(getTableMascot(4).base).toBe('dog');      // four legs
  });

  test('each mascot resolves to a real, distinct character', () => {
    const ids = new Set();
    for (let table = 1; table <= 12; table++) {
      const id = getTableMascot(table).avatarId;
      expect(getAvatar(id).id).toBe(id);
      expect(getAvatar(id).base).toBe(getTableMascot(table).base);
      ids.add(id);
    }
    expect(ids.size).toBe(12);
  });

  test('out-of-range tables fall back to the first mascot', () => {
    expect(getTableMascot(0)).toBe(TABLE_MASCOTS[1]);
    expect(getTableMascot(99)).toBe(TABLE_MASCOTS[1]);
  });
});
