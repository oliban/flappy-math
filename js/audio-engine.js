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

export function createAudioEngine({ audioContextFactory = defaultAudioContextFactory, fetchFn } = {}) {
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

    // Fetch + decode once; concurrent callers share the promise
    load(url) {
      const c = context();
      if (!c) return Promise.resolve(null);
      if (buffers.has(url)) return Promise.resolve(buffers.get(url));
      if (pending.has(url)) return pending.get(url);
      const p = _fetch(url)
        .then(res => (res && res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res && res.status}`))))
        .then(data => c.decodeAudioData(data))
        .then(buffer => { buffers.set(url, buffer); pending.delete(url); return buffer; })
        .catch(() => { pending.delete(url); return null; });
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
