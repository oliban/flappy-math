import { describe, test, expect, vi } from 'vitest';
import { createAudioEngine } from './audio-engine.js';

function ctxMock() {
  return { state: 'running', currentTime: 0, destination: {}, resume: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn(async (buf) => ({ duration: 0.5, name: buf.name })),
    createBufferSource: vi.fn(() => ({ connect() {}, start() {} })) };
}
const ok = (url) => ({ ok: true, status: 200, arrayBuffer: async () => ({ name: url }) });

describe('audio engine loading', () => {
  test('retries a failed fetch before giving up', async () => {
    let calls = 0;
    const fetchFn = vi.fn(async (url) => { calls++; if (calls === 1) throw new TypeError('Load failed'); return ok(url); });
    const engine = createAudioEngine({ audioContextFactory: () => ctxMock(), fetchFn, retryDelayMs: 1 });
    const buffer = await engine.load('sounds/numbers/sv/sv_num_6.mp3');
    expect(buffer).not.toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  test('retries a failed decode too', async () => {
    const ctx = ctxMock();
    let decodes = 0;
    ctx.decodeAudioData = vi.fn(async (buf) => { decodes++; if (decodes === 1) throw new Error('Decoding failed'); return { duration: 0.5, name: buf.name }; });
    const engine = createAudioEngine({ audioContextFactory: () => ctx, fetchFn: vi.fn(async (u) => ok(u)), retryDelayMs: 1 });
    expect(await engine.load('x.mp3')).not.toBeNull();
    expect(decodes).toBe(2);
  });

  test('returns null after the retries are exhausted and does not cache the failure', async () => {
    const fetchFn = vi.fn(async () => { throw new TypeError('Load failed'); });
    const engine = createAudioEngine({ audioContextFactory: () => ctxMock(), fetchFn, retryDelayMs: 1 });
    expect(await engine.load('x.mp3')).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(3);
    await engine.load('x.mp3');
    expect(fetchFn).toHaveBeenCalledTimes(6); // tried again on the next request
  });
});
