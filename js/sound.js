import { createAudioEngine } from './audio-engine.js';

const SOUNDS = {
  crash: 'sounds/crash.mp3',
  thud: 'sounds/thud.mp3',
  correct: 'sounds/correct.mp3',
  wrong: 'sounds/wrong.mp3',
  flap: 'sounds/flap.mp3',
  gameover: 'sounds/gameover.mp3',
  mastery: 'sounds/mastery.mp3',
  fanfare: 'sounds/fanfare.wav'   // beating your own best score
};

export function createSoundPlayer({ audioContextFactory, fetchFn, AudioClass } = {}) {
  const engine = createAudioEngine({ audioContextFactory, fetchFn });
  const _Audio = AudioClass !== undefined ? AudioClass : (typeof Audio !== 'undefined' ? Audio : null);
  const elements = new Map(); // fallback <audio> elements
  let unlocked = false;
  let muted = false;

  return {
    preload() {
      if (engine.isAvailable()) {
        engine.loadAll(Object.values(SOUNDS), 4);
      } else if (_Audio) {
        for (const [name, path] of Object.entries(SOUNDS)) {
          if (elements.has(name)) continue;
          const audio = new _Audio(path);
          audio.load();
          elements.set(name, audio);
        }
      }
    },

    // Must be called from a user gesture the first time
    unlock() {
      if (unlocked) return;
      unlocked = true;
      engine.resume();
      this.preload();
    },

    play(name) {
      if (muted) return;
      const path = SOUNDS[name];
      if (!path) return;

      if (engine.isAvailable()) {
        const buffer = engine.get(path);
        if (buffer) engine.play(buffer);
        return;
      }

      const audio = elements.get(name);
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    },

    // Expose the shared engine so other audio (character voices) can use the same context
    engine,

    setMuted(value) {
      muted = value;
    },

    isMuted() {
      return muted;
    }
  };
}
