import { createAudioEngine } from './audio-engine.js';

const VOICE_STORAGE_KEY = 'flappy-math-voice';

export function createVoicePlayer(storage, AudioClass, { audioContextFactory, fetchFn } = {}) {
  const _storage = storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null);
  const _Audio = AudioClass !== undefined ? AudioClass : (typeof Audio !== 'undefined' ? Audio : null);
  const engine = createAudioEngine({ audioContextFactory, fetchFn });

  let enabled = true;
  let currentLang = 'en';
  let sequenceId = 0;             // newer speech cancels older pending speech
  const elementCache = new Map(); // fallback <audio> elements

  function getAudioPath(type, value) {
    const prefix = currentLang === 'sv' ? 'sv' : 'en';
    if (type === 'number') return `sounds/numbers/${prefix}/${prefix}_num_${value}.mp3`;
    if (type === 'times') return `sounds/numbers/${prefix}/${prefix}_times.mp3`;
    return null;
  }

  // --- Web Audio path: decode once, schedule clips back to back (gapless) ---
  function playSequenceWebAudio(paths) {
    const id = ++sequenceId;
    engine.resume();
    Promise.all(paths.map(p => engine.load(p))).then(buffers => {
      if (id !== sequenceId) return; // superseded by a newer question
      let when = engine.now();
      for (const buffer of buffers) {
        if (!buffer) continue;
        engine.play(buffer, when);
        when += buffer.duration;
      }
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

  function playSequenceElements(paths) {
    let index = 0;
    const playNext = () => {
      if (index >= paths.length) return;
      const clone = getElement(paths[index]).cloneNode();
      index++;
      clone.onended = playNext;
      clone.onerror = playNext;
      clone.play().catch(playNext);
    };
    playNext();
  }

  function playSequence(paths) {
    if (paths.length === 0) return;
    if (engine.isAvailable()) playSequenceWebAudio(paths);
    else if (_Audio) playSequenceElements(paths);
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

    isAvailable() {
      return engine.isAvailable() || (_Audio !== null && _Audio !== undefined);
    }
  };
}
