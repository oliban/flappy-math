import { createAudioEngine } from './audio-engine.js';

const VOICE_STORAGE_KEY = 'flappy-math-voice';

export function createVoicePlayer(storage, AudioClass, { audioContextFactory, fetchFn } = {}) {
  const _storage = storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null);
  const _Audio = AudioClass !== undefined ? AudioClass : (typeof Audio !== 'undefined' ? Audio : null);
  const engine = createAudioEngine({ audioContextFactory, fetchFn });

  let enabled = true;
  let currentLang = 'en';
  const elementCache = new Map(); // fallback <audio> elements

  // Speech never overlaps: one sequence sounds at a time. A request that
  // arrives while a sequence is still LOADING replaces it (no point saying a
  // stale question); one that arrives while a sequence is PLAYING waits and
  // only the latest waiting request is spoken afterwards.
  let phase = 'idle';   // 'idle' | 'loading' | 'playing'
  let loadId = 0;       // bumped to drop a superseded loading sequence
  let pending = null;   // paths waiting for the current playback to end

  function getAudioPath(type, value) {
    const prefix = currentLang === 'sv' ? 'sv' : 'en';
    if (type === 'number') return `sounds/numbers/${prefix}/${prefix}_num_${value}.mp3`;
    if (type === 'times') return `sounds/numbers/${prefix}/${prefix}_times.mp3`;
    return null;
  }

  function finished() {
    phase = 'idle';
    if (pending) {
      const next = pending;
      pending = null;
      startSequence(next);
    }
  }

  // --- Web Audio: decode once, schedule clips back to back (gapless) ---
  function runWebAudio(paths) {
    const id = ++loadId;
    engine.resume();
    Promise.all(paths.map(p => engine.load(p))).then(buffers => {
      if (id !== loadId) return; // superseded while loading; the newer one owns the phase
      const clips = buffers.filter(Boolean);
      if (clips.length === 0) { finished(); return; }
      phase = 'playing';
      let when = engine.now();
      let last = null;
      for (const buffer of clips) {
        last = engine.play(buffer, when);
        when += buffer.duration;
      }
      let done = false;
      const end = () => { if (!done) { done = true; finished(); } };
      if (last) last.onended = end;
      // Safety net in case 'ended' never fires (context suspended by the OS, etc.)
      setTimeout(end, Math.ceil((when - engine.now()) * 1000) + 500);
    });
  }

  // --- Fallback: <audio> elements chained on 'ended' ---
  function getElement(path) {
    if (!elementCache.has(path)) {
      const audio = new _Audio(path);
      audio.load();
      elementCache.set(path, audio);
    }
    return elementCache.get(path);
  }

  function runElements(paths) {
    phase = 'playing';
    let index = 0;
    const playNext = () => {
      if (index >= paths.length) { finished(); return; }
      const clone = getElement(paths[index]).cloneNode();
      index++;
      clone.onended = playNext;
      clone.onerror = playNext;
      clone.play().catch(playNext);
    };
    playNext();
  }

  function startSequence(paths) {
    if (engine.isAvailable()) {
      phase = 'loading';
      runWebAudio(paths);
    } else if (_Audio) {
      runElements(paths);
    }
  }

  function playSequence(paths) {
    if (paths.length === 0) return;
    if (phase === 'playing') { pending = paths; return; }
    startSequence(paths); // idle, or loading (the newer request supersedes the loading one)
  }

  return {
    init() {
      if (!_storage) return;
      const saved = _storage.getItem(VOICE_STORAGE_KEY);
      if (saved !== null && saved !== undefined) enabled = saved === 'true';
    },

    isEnabled() { return enabled; },

    setEnabled(value) {
      enabled = value;
      if (_storage) _storage.setItem(VOICE_STORAGE_KEY, String(value));
    },

    toggle() {
      this.setEnabled(!enabled);
      return enabled;
    },

    setLanguage(lang) { currentLang = lang; },

    speakQuestion(a, b) {
      if (!enabled || !this.isAvailable()) return;
      playSequence([getAudioPath('number', a), getAudioPath('times'), getAudioPath('number', b)]);
    },

    speakAnswer(answer) {
      if (!enabled || !this.isAvailable()) return;
      playSequence([getAudioPath('number', answer)]);
    },

    preload(numbers) {
      if (!this.isAvailable()) return;
      const paths = [getAudioPath('times'), ...numbers.map(n => getAudioPath('number', n))];
      if (engine.isAvailable()) engine.loadAll(paths, 3);
      else paths.forEach(getElement);
    },

    isSpeaking() {
      return phase === 'playing';
    },

    isAvailable() {
      return engine.isAvailable() || (_Audio !== null && _Audio !== undefined);
    }
  };
}
