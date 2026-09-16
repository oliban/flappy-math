import { describe, test, expect, beforeEach } from 'vitest';
import { createPlayerProfile, sanitizeName } from './player.js';

function mockStorage() {
  const data = {};
  return {
    data,
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: k => { delete data[k]; }
  };
}

describe('player profile', () => {
  let storage;
  beforeEach(() => { storage = mockStorage(); });

  test('has no name until set', () => {
    const p = createPlayerProfile(storage);
    expect(p.hasName()).toBe(false);
    expect(p.getName()).toBe('');
  });

  test('trims and stores the name', () => {
    const p = createPlayerProfile(storage);
    p.setName('  Ella  ');
    expect(p.getName()).toBe('Ella');
    expect(p.hasName()).toBe(true);
  });

  test('caps the name at 12 characters', () => {
    const p = createPlayerProfile(storage);
    p.setName('ABCDEFGHIJKLMNOP');
    expect(p.getName()).toBe('ABCDEFGHIJKL');
  });

  test('stores a chosen avatar and rejects unknown ones', () => {
    const p = createPlayerProfile(storage);
    p.setAvatar('fox');
    expect(p.getAvatarId()).toBe('fox');
    p.setAvatar('dragon');
    expect(p.getAvatarId()).toBe('fox');
  });

  test('remembers name and avatar across sessions', () => {
    const p1 = createPlayerProfile(storage);
    p1.setName('Noah');
    p1.setAvatar('penguin');

    const p2 = createPlayerProfile(storage);
    expect(p2.getName()).toBe('Noah');
    expect(p2.getAvatarId()).toBe('penguin');
  });

  test('survives corrupted storage', () => {
    storage.setItem('flappy-math-player', '{{not json');
    const p = createPlayerProfile(storage);
    expect(p.hasName()).toBe(false);
  });
});

describe('sanitizeName', () => {
  test('strips control characters and collapses whitespace', () => {
    expect(sanitizeName('  Ell\u0007a   Bo\u001Fb ')).toBe('Ella Bob');
  });
  test('caps at 12 characters and trims again', () => {
    expect(sanitizeName('ABCDEFGHIJK LMNOP')).toBe('ABCDEFGHIJK');
  });
  test('non-strings become empty', () => {
    expect(sanitizeName(null)).toBe('');
    expect(sanitizeName(42)).toBe('');
  });
});
