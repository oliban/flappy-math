import { describe, test, expect, vi } from 'vitest';
import { getVoiceProfile, characterDetune, createCharacterVoices, VOICE_PROFILES } from './voices.js';

function mockContext() {
  const created = { osc: [], gain: [], filter: [], noise: [] };
  const ctx = {
    currentTime: 5,
    sampleRate: 44100,
    destination: {},
    state: 'running',
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => {
      const o = { type: 'sine', frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      created.osc.push(o); return o;
    }),
    createGain: vi.fn(() => {
      const g = { gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn() };
      created.gain.push(g); return g;
    }),
    createBiquadFilter: vi.fn(() => {
      const f = { type: 'lowpass', frequency: { value: 1000, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, Q: { value: 1 }, connect: vi.fn() };
      created.filter.push(f); return f;
    }),
    createBuffer: vi.fn((ch, len) => ({ getChannelData: () => new Float32Array(len), duration: len / 44100 })),
    createBufferSource: vi.fn(() => { const s = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }; created.noise.push(s); return s; })
  };
  return { ctx, created };
}

describe('voice profiles', () => {
  test('every body type has a profile with sensible pitch and duration', () => {
    for (const [base, p] of Object.entries(VOICE_PROFILES)) {
      expect(p.f0, base).toBeGreaterThan(60);
      expect(p.f0, base).toBeLessThan(4000);
      expect(p.dur, base).toBeGreaterThan(0.05);
      expect(p.dur, base).toBeLessThan(1);
      expect(['sine', 'square', 'triangle', 'sawtooth']).toContain(p.wave);
    }
  });

  test('picks the profile by the character body type', () => {
    expect(getVoiceProfile({ id: 'x', base: 'frog' })).toBe(VOICE_PROFILES.frog);
  });

  test('starters without a base field use their id as body type', () => {
    expect(getVoiceProfile({ id: 'owl' })).toBe(VOICE_PROFILES.owl);
  });

  test('unknown body types fall back to the bird chirp', () => {
    expect(getVoiceProfile({ id: 'mystery', base: 'blob-of-doom' })).toBe(VOICE_PROFILES.bird);
  });

  test('detune is deterministic per id and spread across characters', () => {
    expect(characterDetune('sir-pounce')).toBe(characterDetune('sir-pounce'));
    const values = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(characterDetune));
    expect(values.size).toBeGreaterThan(4);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0.8);
      expect(v).toBeLessThanOrEqual(1.25);
    }
  });
});

describe('character voices', () => {
  test('playJump synthesizes a short sound through an oscillator and gain envelope', () => {
    const { ctx, created } = mockContext();
    const voices = createCharacterVoices(() => ctx);
    voices.playJump({ id: 'bird', base: 'bird' });
    expect(created.osc.length).toBeGreaterThan(0);
    expect(created.gain.length).toBeGreaterThan(0);
    expect(created.osc[0].start).toHaveBeenCalled();
    expect(created.osc[0].stop).toHaveBeenCalled();
  });

  test('two characters of the same type get different pitches', () => {
    const { ctx, created } = mockContext();
    const voices = createCharacterVoices(() => ctx);
    const voiced = () => created.osc.filter(o => o.frequency.setValueAtTime.mock.calls.length > 0);
    voices.playJump({ id: 'pinto-the-cat', base: 'cat' });
    const f1 = voiced()[0].frequency.setValueAtTime.mock.calls[0][0];
    voices.playJump({ id: 'nibbles-the-cat', base: 'cat' });
    const all = voiced();
    const f2 = all[all.length - 1].frequency.setValueAtTime.mock.calls[0][0];
    expect(f1).not.toBe(f2);
  });

  test('robots beep with a square wave, ghosts glide with a sine', () => {
    const { ctx, created } = mockContext();
    const voices = createCharacterVoices(() => ctx);
    voices.playJump({ id: 'r', base: 'robot' });
    expect(created.osc[0].type).toBe('square');
    voices.playJump({ id: 'g', base: 'ghost' });
    expect(created.osc[created.osc.length - 1].type).toBe('sine');
  });

  test('does nothing without an audio context', () => {
    const voices = createCharacterVoices(() => null);
    expect(() => voices.playJump({ id: 'bird' })).not.toThrow();
  });

  test('respects mute', () => {
    const { ctx, created } = mockContext();
    const voices = createCharacterVoices(() => ctx);
    voices.setMuted(true);
    voices.playJump({ id: 'bird' });
    expect(created.osc.length).toBe(0);
  });
});
