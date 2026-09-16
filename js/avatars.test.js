import { describe, test, expect } from 'vitest';
import { AVATARS, getAvatar, drawAvatar, DEFAULT_AVATAR_ID } from './avatars.js';

// Minimal canvas context stand-in: records calls, tolerates any 2D API method.
function fakeContext() {
  const calls = [];
  const gradient = { addColorStop: () => {} };
  const state = {};
  return new Proxy(state, {
    get(target, prop) {
      if (prop === 'calls') return calls;
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => gradient;
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop in target) return target[prop];
      return (...args) => { calls.push(prop); };
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}

describe('avatars', () => {
  test('offers at least six distinct animals', () => {
    expect(AVATARS.length).toBeGreaterThanOrEqual(6);
    const ids = new Set(AVATARS.map(a => a.id));
    expect(ids.size).toBe(AVATARS.length);
  });

  test('every avatar has an id, name and a drawing routine', () => {
    for (const a of AVATARS) {
      expect(typeof a.id).toBe('string');
      expect(typeof a.name).toBe('string');
      expect(typeof a.draw).toBe('function');
    }
  });

  test('getAvatar returns the matching avatar', () => {
    expect(getAvatar('fox').id).toBe('fox');
  });

  test('getAvatar falls back to the default for unknown ids', () => {
    expect(getAvatar('dragon').id).toBe(DEFAULT_AVATAR_ID);
    expect(getAvatar(undefined).id).toBe(DEFAULT_AVATAR_ID);
  });

  test('every avatar draws with vector primitives and balances save/restore', () => {
    for (const a of AVATARS) {
      const ctx = fakeContext();
      expect(() => drawAvatar(ctx, a.id, 15, 0.5)).not.toThrow();
      const calls = ctx.calls;
      expect(calls.filter(c => c === 'fill').length).toBeGreaterThan(3);
      expect(calls.filter(c => c === 'save').length).toBe(calls.filter(c => c === 'restore').length);
      expect(calls).not.toContain('fillText');
    }
  });
});
