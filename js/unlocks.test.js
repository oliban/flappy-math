import { describe, test, expect, beforeEach } from 'vitest';
import { createUnlocks, weekKey, dayKey } from './unlocks.js';

function mockStorage() {
  const data = {};
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}

const STARTERS = ['bird', 'cat'];
const ALL = ['bird', 'cat', 'knight', 'wizard', 'robot', 'ghost', 'slime'];

function make(storage, now) {
  return createUnlocks({ storage, starterIds: STARTERS, allIds: ALL, now: () => now });
}

describe('keys', () => {
  test('weekKey is ISO year-week', () => {
    expect(weekKey(new Date(2026, 8, 16))).toBe('2026-W38');
    expect(weekKey(new Date(2024, 11, 31))).toBe('2025-W01');
  });
  test('dayKey is local YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 8, 16, 23, 30))).toBe('2026-09-16');
  });
});

describe('unlocks', () => {
  let storage;
  beforeEach(() => { storage = mockStorage(); });

  test('starters are always unlocked', () => {
    const u = make(storage, new Date(2026, 8, 16));
    expect(u.isUnlocked('bird')).toBe(true);
    expect(u.isUnlocked('knight')).toBe(false);
    expect(u.unlockedIds()).toEqual(expect.arrayContaining(STARTERS));
  });

  test('first visit in a week drops one new character', () => {
    const u = make(storage, new Date(2026, 8, 16));
    const dropped = u.claimWeeklyDrop();
    expect(ALL).toContain(dropped);
    expect(STARTERS).not.toContain(dropped);
    expect(u.isUnlocked(dropped)).toBe(true);
  });

  test('the weekly drop is only granted once per week', () => {
    const u = make(storage, new Date(2026, 8, 16));
    u.claimWeeklyDrop();
    expect(u.claimWeeklyDrop()).toBeNull();
    const laterSameWeek = make(storage, new Date(2026, 8, 19));
    expect(laterSameWeek.claimWeeklyDrop()).toBeNull();
  });

  test('a new week drops another character', () => {
    const u1 = make(storage, new Date(2026, 8, 16));
    const first = u1.claimWeeklyDrop();
    const u2 = make(storage, new Date(2026, 8, 23));
    const second = u2.claimWeeklyDrop();
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(u2.unlockedIds().length).toBe(STARTERS.length + 2);
  });

  test('the weekly drop depends on the device seed, so two devices differ', () => {
    const picks = new Set();
    for (let i = 0; i < 12; i++) {
      const s = mockStorage();
      s.setItem('flappy-math-device', `device-${i}`);
      picks.add(make(s, new Date(2026, 8, 16)).claimWeeklyDrop());
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  test('the weekly drop is deterministic for the same device and week', () => {
    const a = mockStorage(); a.setItem('flappy-math-device', 'same');
    const b = mockStorage(); b.setItem('flappy-math-device', 'same');
    expect(make(a, new Date(2026, 8, 16)).claimWeeklyDrop())
      .toBe(make(b, new Date(2026, 8, 17)).claimWeeklyDrop());
  });

  test('a device seed is created and persisted on first use', () => {
    make(storage, new Date(2026, 8, 16));
    const seed = storage.getItem('flappy-math-device');
    expect(typeof seed).toBe('string');
    expect(seed.length).toBeGreaterThan(5);
    make(storage, new Date(2026, 8, 16));
    expect(storage.getItem('flappy-math-device')).toBe(seed);
  });

  test('beating the highscore unlocks a character, at most once per day', () => {
    const u = make(storage, new Date(2026, 8, 16, 10));
    const first = u.claimHighscoreUnlock();
    expect(first).not.toBeNull();
    expect(u.isUnlocked(first)).toBe(true);
    expect(u.claimHighscoreUnlock()).toBeNull();
    const nextDay = make(storage, new Date(2026, 8, 17, 9));
    expect(nextDay.claimHighscoreUnlock()).not.toBeNull();
  });

  test('highscore and weekly unlocks never hand out the same character twice', () => {
    const u = make(storage, new Date(2026, 8, 16));
    const got = [u.claimWeeklyDrop(), u.claimHighscoreUnlock()];
    expect(new Set(got).size).toBe(2);
  });

  test('returns null when everything is already unlocked', () => {
    const u = createUnlocks({ storage, starterIds: ALL, allIds: ALL, now: () => new Date(2026, 8, 16) });
    expect(u.claimWeeklyDrop()).toBeNull();
    expect(u.claimHighscoreUnlock()).toBeNull();
  });

  test('persists unlocks across instances', () => {
    const id = make(storage, new Date(2026, 8, 16)).claimWeeklyDrop();
    expect(make(storage, new Date(2026, 8, 16)).isUnlocked(id)).toBe(true);
  });

  test('survives corrupted storage', () => {
    storage.setItem('flappy-math-unlocks', '{oops');
    const u = make(storage, new Date(2026, 8, 16));
    expect(u.unlockedIds()).toEqual(expect.arrayContaining(STARTERS));
  });
});
