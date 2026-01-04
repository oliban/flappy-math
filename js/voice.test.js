import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createVoicePlayer } from './voice.js';

describe('Voice Player', () => {
  let mockStorage;
  let mockSynthesis;
  let MockUtterance;

  beforeEach(() => {
    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    };

    mockSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn()
    };

    MockUtterance = class {
      constructor() {
        this.lang = '';
        this.rate = 1;
        this.pitch = 1;
      }
    };
  });

  describe('initialization', () => {
    test('defaults to enabled when no saved preference', () => {
      mockStorage.getItem.mockReturnValue(null);
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.init();

      expect(player.isEnabled()).toBe(true);
    });

    test('loads enabled=true from localStorage', () => {
      mockStorage.getItem.mockReturnValue('true');
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.init();

      expect(player.isEnabled()).toBe(true);
    });

    test('loads enabled=false from localStorage', () => {
      mockStorage.getItem.mockReturnValue('false');
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.init();

      expect(player.isEnabled()).toBe(false);
    });
  });

  describe('toggle and persistence', () => {
    test('toggle switches enabled state', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);

      expect(player.isEnabled()).toBe(true);
      player.toggle();
      expect(player.isEnabled()).toBe(false);
      player.toggle();
      expect(player.isEnabled()).toBe(true);
    });

    test('setEnabled saves to localStorage', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);

      player.setEnabled(false);
      expect(mockStorage.setItem).toHaveBeenCalledWith('flappy-math-voice', 'false');

      player.setEnabled(true);
      expect(mockStorage.setItem).toHaveBeenCalledWith('flappy-math-voice', 'true');
    });

    test('toggle returns new enabled state', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);

      expect(player.toggle()).toBe(false);
      expect(player.toggle()).toBe(true);
    });
  });

  describe('speech control', () => {
    test('speakQuestion does nothing when disabled', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis, MockUtterance);
      player.setEnabled(false);
      player.speakQuestion(12, 7);

      expect(mockSynthesis.speak).not.toHaveBeenCalled();
    });

    test('speakAnswer does nothing when disabled', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis, MockUtterance);
      player.setEnabled(false);
      player.speakAnswer(84);

      expect(mockSynthesis.speak).not.toHaveBeenCalled();
    });

    test('speakQuestion calls synthesis.speak when enabled', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis, MockUtterance);
      player.speakQuestion(12, 7);

      expect(mockSynthesis.speak).toHaveBeenCalled();
    });

    test('speakAnswer calls synthesis.speak when enabled', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis, MockUtterance);
      player.speakAnswer(84);

      expect(mockSynthesis.speak).toHaveBeenCalled();
    });

    test('speaks without cancelling to allow queuing', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis, MockUtterance);
      player.speakQuestion(5, 3);

      expect(mockSynthesis.cancel).not.toHaveBeenCalled();
      expect(mockSynthesis.speak).toHaveBeenCalled();
    });
  });

  describe('English number-to-words', () => {
    test('converts single digit numbers', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('en');

      expect(player.numberToWords(1)).toBe('one');
      expect(player.numberToWords(5)).toBe('five');
      expect(player.numberToWords(9)).toBe('nine');
    });

    test('converts teens', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('en');

      expect(player.numberToWords(10)).toBe('ten');
      expect(player.numberToWords(11)).toBe('eleven');
      expect(player.numberToWords(12)).toBe('twelve');
      expect(player.numberToWords(13)).toBe('thirteen');
      expect(player.numberToWords(19)).toBe('nineteen');
    });

    test('converts decades', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('en');

      expect(player.numberToWords(20)).toBe('twenty');
      expect(player.numberToWords(30)).toBe('thirty');
      expect(player.numberToWords(50)).toBe('fifty');
      expect(player.numberToWords(90)).toBe('ninety');
    });

    test('converts compound numbers 21-99', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('en');

      expect(player.numberToWords(21)).toBe('twenty-one');
      expect(player.numberToWords(42)).toBe('forty-two');
      expect(player.numberToWords(84)).toBe('eighty-four');
      expect(player.numberToWords(99)).toBe('ninety-nine');
    });

    test('converts 100', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('en');

      expect(player.numberToWords(100)).toBe('one hundred');
    });

    test('converts numbers 101-144', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('en');

      expect(player.numberToWords(101)).toBe('one hundred one');
      expect(player.numberToWords(110)).toBe('one hundred ten');
      expect(player.numberToWords(112)).toBe('one hundred twelve');
      expect(player.numberToWords(120)).toBe('one hundred twenty');
      expect(player.numberToWords(121)).toBe('one hundred twenty-one');
      expect(player.numberToWords(144)).toBe('one hundred forty-four');
    });
  });

  describe('Swedish number-to-words', () => {
    test('converts single digit numbers', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('sv');

      expect(player.numberToWords(1)).toBe('ett');
      expect(player.numberToWords(2)).toBe('två');
      expect(player.numberToWords(5)).toBe('fem');
      expect(player.numberToWords(9)).toBe('nio');
    });

    test('converts 10-12', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('sv');

      expect(player.numberToWords(10)).toBe('tio');
      expect(player.numberToWords(11)).toBe('elva');
      expect(player.numberToWords(12)).toBe('tolv');
    });

    test('converts teens 13-19', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('sv');

      expect(player.numberToWords(13)).toBe('tretton');
      expect(player.numberToWords(14)).toBe('fjorton');
      expect(player.numberToWords(19)).toBe('nitton');
    });

    test('converts decades', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('sv');

      expect(player.numberToWords(20)).toBe('tjugo');
      expect(player.numberToWords(30)).toBe('trettio');
      expect(player.numberToWords(50)).toBe('femtio');
      expect(player.numberToWords(90)).toBe('nittio');
    });

    test('converts compound numbers 21-99', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('sv');

      expect(player.numberToWords(21)).toBe('tjugoett');
      expect(player.numberToWords(42)).toBe('fyrtiotvå');
      expect(player.numberToWords(84)).toBe('åttiofyra');
      expect(player.numberToWords(99)).toBe('nittionio');
    });

    test('converts 100', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('sv');

      expect(player.numberToWords(100)).toBe('hundra');
    });

    test('converts numbers 101-144', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      player.setLanguage('sv');

      expect(player.numberToWords(101)).toBe('hundraett');
      expect(player.numberToWords(110)).toBe('hundratio');
      expect(player.numberToWords(112)).toBe('hundratolv');
      expect(player.numberToWords(120)).toBe('hundratjugo');
      expect(player.numberToWords(121)).toBe('hundratjugoett');
      expect(player.numberToWords(144)).toBe('hundrafyrtiofyra');
    });
  });

  describe('language switching', () => {
    test('setLanguage changes number conversion', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);

      player.setLanguage('en');
      expect(player.numberToWords(7)).toBe('seven');

      player.setLanguage('sv');
      expect(player.numberToWords(7)).toBe('sju');
    });

    test('defaults to English', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      expect(player.numberToWords(7)).toBe('seven');
    });
  });

  describe('synthesis availability', () => {
    test('isAvailable returns true when synthesis exists', () => {
      const player = createVoicePlayer(mockStorage, mockSynthesis);
      expect(player.isAvailable()).toBe(true);
    });

    test('isAvailable returns false when synthesis is null', () => {
      const player = createVoicePlayer(mockStorage, null);
      expect(player.isAvailable()).toBe(false);
    });

    test('speak does nothing when synthesis is null', () => {
      const player = createVoicePlayer(mockStorage, null);
      // Should not throw
      player.speakQuestion(12, 7);
      player.speakAnswer(84);
    });
  });
});
