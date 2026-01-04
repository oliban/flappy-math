const VOICE_STORAGE_KEY = 'flappy-math-voice';

export function createVoicePlayer(storage, AudioClass) {
  const _storage = storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null);
  const _Audio = AudioClass !== undefined ? AudioClass : (typeof Audio !== 'undefined' ? Audio : null);

  let enabled = true;
  let currentLang = 'en';
  const audioCache = new Map();

  function getAudioPath(type, value) {
    const prefix = currentLang === 'sv' ? 'sv' : 'en';
    if (type === 'number') {
      return `sounds/numbers/${prefix}/${prefix}_num_${value}.mp3`;
    } else if (type === 'times') {
      return `sounds/numbers/${prefix}/${prefix}_times.mp3`;
    }
    return null;
  }

  function getAudio(path) {
    if (!audioCache.has(path)) {
      const audio = new _Audio(path);
      audio.load();
      audioCache.set(path, audio);
    }
    return audioCache.get(path);
  }

  function playSequence(paths) {
    if (!_Audio || paths.length === 0) return;

    let index = 0;

    function playNext() {
      if (index >= paths.length) return;

      const audio = getAudio(paths[index]);
      index++;

      // Clone to allow overlapping/rapid playback
      const clone = audio.cloneNode();
      clone.onended = playNext;
      clone.onerror = playNext;
      clone.play().catch(playNext);
    }

    playNext();
  }

  return {
    init() {
      if (!_storage) return;
      const saved = _storage.getItem(VOICE_STORAGE_KEY);
      if (saved !== null) {
        enabled = saved === 'true';
      }
    },

    isEnabled() {
      return enabled;
    },

    setEnabled(value) {
      enabled = value;
      if (_storage) {
        _storage.setItem(VOICE_STORAGE_KEY, String(value));
      }
    },

    toggle() {
      this.setEnabled(!enabled);
      return enabled;
    },

    setLanguage(lang) {
      currentLang = lang;
    },

    speakQuestion(a, b) {
      if (!enabled || !_Audio) return;

      playSequence([
        getAudioPath('number', a),
        getAudioPath('times'),
        getAudioPath('number', b)
      ]);
    },

    speakAnswer(answer) {
      if (!enabled || !_Audio) return;

      playSequence([getAudioPath('number', answer)]);
    },

    preload(numbers) {
      if (!_Audio) return;

      // Preload "times" word
      getAudio(getAudioPath('times'));

      // Preload all numbers
      for (const n of numbers) {
        getAudio(getAudioPath('number', n));
      }
    },

    isAvailable() {
      return _Audio !== null && _Audio !== undefined;
    }
  };
}
