import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createVoicePlayer } from './voice.js';

function mockWebAudio() {
  const started = [];
  const ctx = {
    state: 'running',
    currentTime: 10,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn((buf) => Promise.resolve({ duration: 0.5, name: buf.name })),
    createBufferSource: vi.fn(() => {
      const src = { buffer: null, connect: vi.fn(), start: vi.fn((when) => started.push({ name: src.buffer.name, when, src })), onended: null };
      return src;
    })
  };
  const fetched = [];
  const fetchFn = vi.fn((url) => { fetched.push(url); return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve({ name: url }) }); });
  return { ctx, fetchFn, started, fetched, factory: () => ctx };
}

function MockAudioClass() {
  const instances = [];
  const Cls = class {
    constructor(src) { this.src = src; this.onended = null; this.onerror = null; instances.push(this); }
    load() {}
    play() { setTimeout(() => this.onended && this.onended(), 0); return Promise.resolve(); }
    cloneNode() { return new Cls(this.src); }
  };
  return { Cls, instances };
}

const flush = async (n = 4) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };

describe('Voice Player', () => {
  let mockStorage;
  let wa;

  beforeEach(() => {
    mockStorage = { getItem: vi.fn(), setItem: vi.fn() };
    wa = mockWebAudio();
  });

  const make = (opts = {}) => createVoicePlayer(mockStorage, undefined, { audioContextFactory: wa.factory, fetchFn: wa.fetchFn, ...opts });

  describe('preferences', () => {
    test('defaults to enabled', () => {
      mockStorage.getItem.mockReturnValue(null);
      const p = make(); p.init();
      expect(p.isEnabled()).toBe(true);
    });
    test('loads enabled=false from storage', () => {
      mockStorage.getItem.mockReturnValue('false');
      const p = make(); p.init();
      expect(p.isEnabled()).toBe(false);
    });
    test('toggle flips and saves', () => {
      const p = make();
      expect(p.toggle()).toBe(false);
      expect(mockStorage.setItem).toHaveBeenCalledWith('flappy-math-voice', 'false');
    });
  });

  describe('speaking with Web Audio', () => {
    test('speakQuestion fetches number, times, number once and schedules them back to back', async () => {
      const p = make();
      p.speakQuestion(12, 7);
      await flush();
      expect(wa.fetched).toEqual(expect.arrayContaining([
        'sounds/numbers/en/en_num_12.mp3', 'sounds/numbers/en/en_times.mp3', 'sounds/numbers/en/en_num_7.mp3'
      ]));
      expect(wa.started.map(s => s.name)).toEqual([
        'sounds/numbers/en/en_num_12.mp3', 'sounds/numbers/en/en_times.mp3', 'sounds/numbers/en/en_num_7.mp3'
      ]);
      // gapless: each clip starts when the previous ends
      expect(wa.started[1].when - wa.started[0].when).toBeCloseTo(0.5, 5);
      expect(wa.started[2].when - wa.started[1].when).toBeCloseTo(0.5, 5);
    });

    test('a clip is fetched and decoded only once even when spoken repeatedly', async () => {
      const p = make();
      p.speakAnswer(84); await flush();
      wa.started[0].src.onended();          // first playback ends
      p.speakAnswer(84); await flush();
      expect(wa.fetched.filter(u => u.endsWith('en_num_84.mp3')).length).toBe(1);
      expect(wa.started.filter(s => s.name.endsWith('en_num_84.mp3')).length).toBe(2);
    });

    test('a newer question cancels a pending older one', async () => {
      const p = make();
      p.speakQuestion(2, 3);
      p.speakQuestion(4, 5);
      await flush();
      const names = wa.started.map(s => s.name);
      expect(names).not.toContain('sounds/numbers/en/en_num_2.mp3');
      expect(names).toContain('sounds/numbers/en/en_num_4.mp3');
    });

    test('does nothing when disabled', async () => {
      const p = make();
      p.setEnabled(false);
      p.speakQuestion(12, 7); p.speakAnswer(3);
      await flush();
      expect(wa.fetched.length).toBe(0);
    });

    test('setLanguage switches to Swedish clips', async () => {
      const p = make();
      p.setLanguage('sv');
      p.speakQuestion(5, 3);
      await flush();
      expect(wa.fetched).toEqual(expect.arrayContaining(['sounds/numbers/sv/sv_num_5.mp3', 'sounds/numbers/sv/sv_times.mp3']));
    });

    test('preload decodes the given numbers plus "times", a few at a time', async () => {
      const p = make();
      p.preload([1, 2, 3, 12]);
      await flush(20);
      expect(wa.fetched).toEqual(expect.arrayContaining([
        'sounds/numbers/en/en_times.mp3', 'sounds/numbers/en/en_num_1.mp3', 'sounds/numbers/en/en_num_12.mp3'
      ]));
      expect(wa.fetched.length).toBe(5);
    });
  });

  describe('no overlapping speech', () => {
    test('a new question waits until the current one has finished playing', async () => {
      const p = make();
      p.speakQuestion(2, 3);
      await flush();
      expect(wa.started.length).toBe(3);           // 2, times, 3 are sounding
      p.speakQuestion(4, 5);
      await flush();
      expect(wa.started.length).toBe(3);           // nothing new started yet
      wa.started[2].src.onended();                 // last clip of the first question ends
      await flush();
      expect(wa.started.map(s => s.name).slice(3)).toEqual([
        'sounds/numbers/en/en_num_4.mp3', 'sounds/numbers/en/en_times.mp3', 'sounds/numbers/en/en_num_5.mp3'
      ]);
    });

    test('only the latest request made during playback is spoken afterwards', async () => {
      const p = make();
      p.speakAnswer(7);
      await flush();
      expect(wa.started.length).toBe(1);
      p.speakQuestion(2, 3);
      p.speakQuestion(8, 9);
      await flush();
      wa.started[0].src.onended();
      await flush();
      const names = wa.started.map(s => s.name);
      expect(names).not.toContain('sounds/numbers/en/en_num_2.mp3');
      expect(names).toContain('sounds/numbers/en/en_num_8.mp3');
      expect(names).toContain('sounds/numbers/en/en_num_9.mp3');
    });

    test('isSpeaking reflects playback state', async () => {
      const p = make();
      expect(p.isSpeaking()).toBe(false);
      p.speakAnswer(7);
      await flush();
      expect(p.isSpeaking()).toBe(true);
      wa.started[0].src.onended();
      await flush();
      expect(p.isSpeaking()).toBe(false);
    });
  });

  describe('fallback to audio elements', () => {
    test('uses Audio elements when Web Audio is unavailable', async () => {
      const { Cls, instances } = MockAudioClass();
      const p = createVoicePlayer(mockStorage, Cls, { audioContextFactory: null });
      p.speakQuestion(12, 7);
      await flush();
      const srcs = instances.map(a => a.src);
      expect(srcs).toContain('sounds/numbers/en/en_num_12.mp3');
      expect(srcs).toContain('sounds/numbers/en/en_times.mp3');
    });

    test('isAvailable reflects whether any audio backend exists', () => {
      expect(createVoicePlayer(mockStorage, null, { audioContextFactory: null }).isAvailable()).toBe(false);
      expect(make().isAvailable()).toBe(true);
      const p = createVoicePlayer(mockStorage, null, { audioContextFactory: null });
      expect(() => { p.speakQuestion(1, 2); p.preload([1]); }).not.toThrow();
    });
  });
});
