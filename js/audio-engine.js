// Shared Web Audio helper. Clips are fetched and decoded ONCE into memory and
// then played as BufferSources: no per-play element cloning, no re-fetching,
// no main-thread stalls on mobile Safari. Falls back to nothing (callers keep
// an <audio> element path) when Web Audio is unavailable.

// One shared context for the whole page (iOS limits the number of contexts)
let sharedContext = null;
export function defaultAudioContextFactory() {
  if (sharedContext) return sharedContext;
  const Ctor = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  sharedContext = Ctor ? new Ctor() : null;
  return sharedContext;
}

const LOAD_ATTEMPTS = 3;

export function createAudioEngine({ audioContextFactory = defaultAudioContextFactory, fetchFn, retryDelayMs = 250 } = {}) {
  const _fetch = fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  let ctx = null;
  let failed = false;
  const buffers = new Map();   // url -> AudioBuffer
  const pending = new Map();   // url -> Promise<AudioBuffer|null>

  function context() {
    if (ctx || failed) return ctx;
    try {
      ctx = audioContextFactory ? audioContextFactory() : null;
    } catch (e) {
      ctx = null;
    }
    if (!ctx || !_fetch) { failed = true; ctx = null; }
    return ctx;
  }

  return {
    isAvailable() {
      return context() !== null;
    },

    // The underlying AudioContext (or null) for synthesized sounds
    context,

    // Call from a user gesture (iOS starts contexts suspended)
    resume() {
      const c = context();
      if (c && c.state !== 'running' && c.resume) {
        c.resume().catch(() => {});
      }
    },

    now() {
      const c = context();
      return c ? c.currentTime : 0;
    },

    get(url) {
      return buffers.get(url) || null;
    },

    // Fetch + decode once; concurrent callers share the promise. Mobile Safari
    // drops fetches ("Load failed") and occasionally rejects a decode while many
    // clips load at once, so each clip gets a few attempts before we give up.
    load(url) {
      const c = context();
      if (!c) return Promise.resolve(null);
      if (buffers.has(url)) return Promise.resolve(buffers.get(url));
      if (pending.has(url)) return pending.get(url);
      const attempt = async (n) => {
        try {
          const res = await _fetch(url);
          if (!res || !res.ok) throw new Error(`HTTP ${res && res.status}`);
          const data = await res.arrayBuffer();
          return await c.decodeAudioData(data);
        } catch (e) {
          if (n + 1 >= LOAD_ATTEMPTS) {
            console.warn(`[audio] could not load ${url} after ${LOAD_ATTEMPTS} attempts:`, e && e.message);
            return null;
          }
          await new Promise(r => setTimeout(r, retryDelayMs * (n + 1)));
          return attempt(n + 1);
        }
      };
      const p = attempt(0).then(buffer => {
        pending.delete(url);
        if (buffer) buffers.set(url, buffer);
        return buffer;
      });
      pending.set(url, p);
      return p;
    },

    // Load many urls with limited concurrency so startup stays smooth
    loadAll(urls, concurrency = 3) {
      const queue = [...urls];
      const worker = () => {
        const url = queue.shift();
        if (!url) return Promise.resolve();
        return this.load(url).then(worker);
      };
      return Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
    },

    // Start a decoded buffer at `when` (context time). Returns the source, or null.
    play(buffer, when) {
      const c = context();
      if (!c || !buffer) return null;
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.connect(c.destination);
      src.start(when === undefined ? c.currentTime : when);
      return src;
    }
  };
}
