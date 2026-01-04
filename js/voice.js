const VOICE_STORAGE_KEY = 'flappy-math-voice';

const LOCALE_MAP = {
  en: 'en-US',
  sv: 'sv-SE'
};

const ENGLISH_NUMBERS = {
  1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five',
  6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten',
  11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen',
  15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen',
  19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty',
  50: 'fifty', 60: 'sixty', 70: 'seventy', 80: 'eighty',
  90: 'ninety', 100: 'one hundred'
};

const SWEDISH_NUMBERS = {
  1: 'ett', 2: 'två', 3: 'tre', 4: 'fyra', 5: 'fem',
  6: 'sex', 7: 'sju', 8: 'åtta', 9: 'nio', 10: 'tio',
  11: 'elva', 12: 'tolv', 13: 'tretton', 14: 'fjorton',
  15: 'femton', 16: 'sexton', 17: 'sjutton', 18: 'arton',
  19: 'nitton', 20: 'tjugo', 30: 'trettio', 40: 'fyrtio',
  50: 'femtio', 60: 'sextio', 70: 'sjuttio', 80: 'åttio',
  90: 'nittio', 100: 'hundra'
};

function convertNumber(n, dict, lang) {
  if (dict[n]) return dict[n];

  if (n > 100) {
    const remainder = n - 100;
    const remainderWord = convertNumber(remainder, dict, lang);
    if (lang === 'sv') {
      return `hundra${remainderWord}`;
    }
    return `one hundred ${remainderWord}`;
  }

  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;

  if (ones === 0) return dict[tens];

  if (lang === 'sv') {
    return `${dict[tens]}${dict[ones]}`;
  }
  return `${dict[tens]}-${dict[ones]}`;
}

export function createVoicePlayer(storage, synthesis, UtteranceClass) {
  // Default to browser APIs if available (allows injection for testing)
  const _storage = storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null);
  const _synthesis = synthesis !== undefined ? synthesis : (typeof window !== 'undefined' ? window.speechSynthesis : null);
  const _UtteranceClass = UtteranceClass !== undefined ? UtteranceClass : (typeof window !== 'undefined' ? window.SpeechSynthesisUtterance : null);
  let enabled = true;
  let currentLang = 'en';
  let unlocked = false;
  let voicesLoaded = false;
  let cachedVoice = null;

  // Wait for voices to load
  if (_synthesis && typeof window !== 'undefined') {
    const loadVoices = () => {
      const voices = _synthesis.getVoices();
      if (voices.length > 0) {
        voicesLoaded = true;
        console.log('[VOICE] Voices loaded:', voices.length);
      }
    };
    loadVoices();
    if (_synthesis.onvoiceschanged !== undefined) {
      _synthesis.onvoiceschanged = loadVoices;
    }
  }

  return {
    // Must be called on user gesture to unlock speech synthesis
    unlock() {
      console.log('[VOICE] unlock() called, already unlocked:', unlocked);
      if (unlocked || !_synthesis || !_UtteranceClass) return;
      // Speak empty utterance to unlock
      const utterance = new _UtteranceClass('');
      utterance.volume = 0;
      utterance.onend = () => console.log('[VOICE] unlock utterance ended');
      utterance.onerror = (e) => console.error('[VOICE] unlock ERROR:', e.error);
      _synthesis.speak(utterance);
      unlocked = true;
      console.log('[VOICE] Speech synthesis unlock attempted');
    },

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
      console.log('[VOICE] speakQuestion:', a, b, 'enabled:', enabled);
      if (!enabled || !_synthesis) return;

      const wordA = this.numberToWords(a);
      const wordB = this.numberToWords(b);
      const text = `${wordA}, ${wordB}`;

      this.speak(text);
    },

    speakAnswer(answer) {
      console.log('[VOICE] speakAnswer:', answer, 'enabled:', enabled, 'unlocked:', unlocked);
      if (!enabled || !_synthesis) return;

      const word = this.numberToWords(answer);
      this.speak(word);
    },

    speak(text) {
      console.log('[VOICE] speak:', text, 'voicesLoaded:', voicesLoaded);
      if (!_synthesis || !_UtteranceClass) return;

      // Check and log synthesis state
      console.log('[VOICE] before speak - paused:', _synthesis.paused, 'speaking:', _synthesis.speaking, 'pending:', _synthesis.pending);

      // Cancel any pending speech first
      _synthesis.cancel();

      const utterance = new _UtteranceClass(text);

      // Try to find a suitable voice - prefer LOCAL voices (more reliable than cloud)
      const voices = _synthesis.getVoices();
      const targetLang = LOCALE_MAP[currentLang] || 'en-US';
      const langCode = targetLang.split('-')[0]; // 'en' or 'sv'

      // Priority: 1) Local voice for language, 2) Any voice for language, 3) First local voice, 4) First voice
      let voice = voices.find(v => v.localService && v.lang.startsWith(langCode));
      if (!voice) voice = voices.find(v => v.lang.startsWith(langCode));
      if (!voice) voice = voices.find(v => v.localService);
      if (!voice) voice = voices[0];

      if (voice) {
        utterance.voice = voice;
        console.log('[VOICE] using voice:', voice.name, voice.lang, 'localService:', voice.localService);
      } else {
        console.log('[VOICE] no voice found!');
        return;
      }

      utterance.lang = targetLang;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => console.log('[VOICE] STARTED:', text);
      utterance.onend = () => console.log('[VOICE] ENDED:', text);
      utterance.onerror = (e) => console.error('[VOICE] ERROR:', e.error);

      console.log('[VOICE] calling synthesis.speak()');
      _synthesis.speak(utterance);

      console.log('[VOICE] after speak - paused:', _synthesis.paused, 'speaking:', _synthesis.speaking, 'pending:', _synthesis.pending);
    },

    numberToWords(n) {
      const dict = currentLang === 'sv' ? SWEDISH_NUMBERS : ENGLISH_NUMBERS;
      return convertNumber(n, dict, currentLang);
    },

    isAvailable() {
      return _synthesis !== null && _synthesis !== undefined;
    }
  };
}
