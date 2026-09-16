import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createSoundPlayer } from './sound.js';

// --- Web Audio mocks ---------------------------------------------------------
function mockWebAudio() {
  const started = [];
  const decoded = [];
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => { ctx.state = 'running'; return Promise.resolve(); }),
    decodeAudioData: vi.fn((buf) => { decoded.push(buf.name); return Promise.resolve({ duration: 0.5, name: buf.name }); }),
    createBufferSource: vi.fn(() => {
      const src = { buffer: null, connect: vi.fn(), start: vi.fn((when) => started.push({ name: src.buffer && src.buffer.name, when })), onended: null };
      return src;
    })
  };
  const fetched = [];
  const fetchFn = vi.fn((url) => { fetched.push(url); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve({ name: url }) }); });
  return { ctx, fetchFn, started, decoded, fetched, factory: () => ctx };
}

function MockAudioClass() {
  const instances = [];
  const Cls = class {
    constructor(src) { this.src = src; this.currentTime = 0; this.load = vi.fn(); this.play = vi.fn(() => Promise.resolve()); instances.push(this); }
  };
  return { Cls, instances };
}

const flush = () => new Promise(r => setTimeout(r, 0));

describe('Sound Player (Web Audio)', () => {
  let wa;
  beforeEach(() => { wa = mockWebAudio(); });

  test('unlock creates the context, resumes it and preloads all 7 sounds', async () => {
    const player = createSoundPlayer({ audioContextFactory: wa.factory, fetchFn: wa.fetchFn });
    player.unlock();
    await flush(); await flush();
    expect(wa.ctx.resume).toHaveBeenCalled();
    expect(wa.fetched.length).toBe(7);
    expect(wa.fetched.some(u => u.endsWith('crash.mp3'))).toBe(true);
    expect(wa.decoded.length).toBe(7);
  });

  test('unlock only runs once', async () => {
    const player = createSoundPlayer({ audioContextFactory: wa.factory, fetchFn: wa.fetchFn });
    player.unlock(); player.unlock();
    await flush(); await flush();
    expect(wa.fetched.length).toBe(7);
  });

  test('play starts a decoded buffer from memory without fetching again', async () => {
    const player = createSoundPlayer({ audioContextFactory: wa.factory, fetchFn: wa.fetchFn });
    player.unlock();
    await flush(); await flush();
    const fetchesBefore = wa.fetched.length;
    player.play('flap');
    player.play('flap');
    expect(wa.started.filter(s => s.name.endsWith('flap.mp3')).length).toBe(2);
    expect(wa.fetched.length).toBe(fetchesBefore);
  });

  test('play before decoding finished does not throw', () => {
    const player = createSoundPlayer({ audioContextFactory: wa.factory, fetchFn: wa.fetchFn });
    player.unlock();
    expect(() => player.play('crash')).not.toThrow();
  });

  test('play does nothing when muted or for unknown names', async () => {
    const player = createSoundPlayer({ audioContextFactory: wa.factory, fetchFn: wa.fetchFn });
    player.unlock();
    await flush(); await flush();
    player.setMuted(true);
    player.play('crash');
    player.setMuted(false);
    player.play('nonexistent');
    expect(wa.started.length).toBe(0);
  });

  test('mute state can be toggled', () => {
    const player = createSoundPlayer({ audioContextFactory: wa.factory, fetchFn: wa.fetchFn });
    expect(player.isMuted()).toBe(false);
    player.setMuted(true);
    expect(player.isMuted()).toBe(true);
  });
});

describe('Sound Player (fallback to audio elements)', () => {
  test('uses Audio elements when Web Audio is unavailable', () => {
    const { Cls, instances } = MockAudioClass();
    const player = createSoundPlayer({ audioContextFactory: null, AudioClass: Cls });
    player.unlock();
    expect(instances.length).toBe(7);
    const crash = instances.find(a => a.src.includes('crash.mp3'));
    crash.currentTime = 5;
    player.play('crash');
    expect(crash.currentTime).toBe(0);
    expect(crash.play).toHaveBeenCalled();
  });

  test('falls back when the context factory throws', () => {
    const { Cls, instances } = MockAudioClass();
    const player = createSoundPlayer({ audioContextFactory: () => { throw new Error('no audio'); }, AudioClass: Cls });
    player.unlock();
    player.play('thud');
    expect(instances.find(a => a.src.includes('thud')).play).toHaveBeenCalled();
  });
});
