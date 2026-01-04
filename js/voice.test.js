import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createVoicePlayer } from './voice.js';

describe('Voice Player', () => {
  let mockStorage;
  let MockAudio;
  let audioInstances;

  beforeEach(() => {
    audioInstances = [];

    mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    };

    MockAudio = class {
      constructor(src) {
        this.src = src;
        this.onended = null;
        this.onerror = null;
        audioInstances.push(this);
      }
      load() {}
      play() {
        // Simulate immediate playback completion
        setTimeout(() => this.onended && this.onended(), 0);
        return Promise.resolve();
      }
      cloneNode() {
        const clone = new MockAudio(this.src);
        return clone;
      }
    };
  });

  describe('initialization', () => {
    test('defaults to enabled when no saved preference', () => {
      mockStorage.getItem.mockReturnValue(null);
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.init();

      expect(player.isEnabled()).toBe(true);
    });

    test('loads enabled=true from localStorage', () => {
      mockStorage.getItem.mockReturnValue('true');
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.init();

      expect(player.isEnabled()).toBe(true);
    });

    test('loads enabled=false from localStorage', () => {
      mockStorage.getItem.mockReturnValue('false');
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.init();

      expect(player.isEnabled()).toBe(false);
    });
  });

  describe('toggle and persistence', () => {
    test('toggle switches enabled state', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);

      expect(player.isEnabled()).toBe(true);
      player.toggle();
      expect(player.isEnabled()).toBe(false);
      player.toggle();
      expect(player.isEnabled()).toBe(true);
    });

    test('setEnabled saves to localStorage', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);

      player.setEnabled(false);
      expect(mockStorage.setItem).toHaveBeenCalledWith('flappy-math-voice', 'false');

      player.setEnabled(true);
      expect(mockStorage.setItem).toHaveBeenCalledWith('flappy-math-voice', 'true');
    });

    test('toggle returns new enabled state', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);

      expect(player.toggle()).toBe(false);
      expect(player.toggle()).toBe(true);
    });
  });

  describe('audio playback', () => {
    test('speakQuestion does nothing when disabled', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.setEnabled(false);
      player.speakQuestion(12, 7);

      expect(audioInstances.length).toBe(0);
    });

    test('speakAnswer does nothing when disabled', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.setEnabled(false);
      player.speakAnswer(84);

      expect(audioInstances.length).toBe(0);
    });

    test('speakQuestion loads audio files when enabled', async () => {
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.speakQuestion(12, 7);

      // Wait for all audio to be queued (setTimeout in mock)
      await new Promise(resolve => setTimeout(resolve, 20));

      // Should load 3 audio files: number, times, number
      const srcs = audioInstances.map(a => a.src);
      expect(srcs).toContain('sounds/numbers/en/en_num_12.mp3');
      expect(srcs).toContain('sounds/numbers/en/en_times.mp3');
      expect(srcs).toContain('sounds/numbers/en/en_num_7.mp3');
    });

    test('speakAnswer loads audio file when enabled', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.speakAnswer(84);

      const srcs = audioInstances.map(a => a.src);
      expect(srcs).toContain('sounds/numbers/en/en_num_84.mp3');
    });
  });

  describe('language switching', () => {
    test('setLanguage changes audio paths to Swedish', async () => {
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.setLanguage('sv');
      player.speakQuestion(5, 3);

      // Wait for all audio to be queued
      await new Promise(resolve => setTimeout(resolve, 20));

      const srcs = audioInstances.map(a => a.src);
      expect(srcs).toContain('sounds/numbers/sv/sv_num_5.mp3');
      expect(srcs).toContain('sounds/numbers/sv/sv_times.mp3');
      expect(srcs).toContain('sounds/numbers/sv/sv_num_3.mp3');
    });

    test('defaults to English audio paths', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.speakAnswer(7);

      const srcs = audioInstances.map(a => a.src);
      expect(srcs).toContain('sounds/numbers/en/en_num_7.mp3');
    });
  });

  describe('audio availability', () => {
    test('isAvailable returns true when Audio exists', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);
      expect(player.isAvailable()).toBe(true);
    });

    test('isAvailable returns false when Audio is null', () => {
      const player = createVoicePlayer(mockStorage, null);
      expect(player.isAvailable()).toBe(false);
    });

    test('speakQuestion does nothing when Audio is null', () => {
      const player = createVoicePlayer(mockStorage, null);
      // Should not throw
      player.speakQuestion(12, 7);
      player.speakAnswer(84);
    });
  });

  describe('preloading', () => {
    test('preload loads specified numbers and times', () => {
      const player = createVoicePlayer(mockStorage, MockAudio);
      player.preload([1, 2, 3, 12]);

      const srcs = audioInstances.map(a => a.src);
      expect(srcs).toContain('sounds/numbers/en/en_times.mp3');
      expect(srcs).toContain('sounds/numbers/en/en_num_1.mp3');
      expect(srcs).toContain('sounds/numbers/en/en_num_2.mp3');
      expect(srcs).toContain('sounds/numbers/en/en_num_3.mp3');
      expect(srcs).toContain('sounds/numbers/en/en_num_12.mp3');
    });

    test('preload does nothing when Audio is null', () => {
      const player = createVoicePlayer(mockStorage, null);
      // Should not throw
      player.preload([1, 2, 3]);
    });
  });
});
