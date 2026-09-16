export const SOUNDS = {
  crash: 'sounds/crash.mp3',
  thud: 'sounds/thud.mp3',
  correct: 'sounds/correct.mp3',
  wrong: 'sounds/wrong.mp3',
  flap: 'sounds/flap.mp3',
  gameover: 'sounds/gameover.mp3',
  mastery: 'sounds/mastery.mp3',
  // Played when a run beats the player's own local highscore.
  fanfare: 'sounds/fanfare.wav'
};

export function createSoundPlayer(AudioClass = Audio) {
  const sounds = new Map();
  let unlocked = false;
  let muted = false;

  return {
    preload() {
      for (const [name, path] of Object.entries(SOUNDS)) {
        const audio = new AudioClass(path);
        audio.load();
        sounds.set(name, audio);
      }
    },

    unlock() {
      if (unlocked) return;

      this.preload();

      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume().then(() => ctx.close());
      } catch (e) {
        // AudioContext not supported, Audio elements should still work
      }

      unlocked = true;
    },

    play(name) {
      if (muted) return;

      const audio = sounds.get(name);
      if (!audio) return;

      audio.currentTime = 0;
      audio.play().catch(() => {
        // Silently fail if autoplay blocked
      });
    },

    setMuted(value) {
      muted = value;
    },

    isMuted() {
      return muted;
    }
  };
}
