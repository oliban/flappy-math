import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createSoundPlayer } from './sound.js';

describe('Sound Player', () => {
  let mockAudios;
  let MockAudioClass;

  beforeEach(() => {
    mockAudios = [];

    MockAudioClass = class {
      constructor(src) {
        this.src = src;
        this.currentTime = 0;
        this.load = vi.fn();
        this.play = vi.fn(() => Promise.resolve());
        mockAudios.push(this);
      }
    };
  });

  test('preload creates audio elements for each sound', () => {
    const player = createSoundPlayer(MockAudioClass);
    player.preload();

    expect(mockAudios.length).toBe(7);
    mockAudios.forEach(audio => {
      expect(audio.load).toHaveBeenCalled();
    });
  });

  test('play resets currentTime and plays the sound', () => {
    const player = createSoundPlayer(MockAudioClass);
    player.preload();

    const crashAudio = mockAudios.find(a => a.src.includes('crash.mp3'));
    crashAudio.currentTime = 5;

    player.play('crash');

    expect(crashAudio.currentTime).toBe(0);
    expect(crashAudio.play).toHaveBeenCalled();
  });

  test('play does nothing when muted', () => {
    const player = createSoundPlayer(MockAudioClass);
    player.preload();
    player.setMuted(true);

    player.play('crash');

    const crashAudio = mockAudios.find(a => a.src.includes('crash.mp3'));
    expect(crashAudio.play).not.toHaveBeenCalled();
  });

  test('play does nothing for unknown sound name', () => {
    const player = createSoundPlayer(MockAudioClass);
    player.preload();

    player.play('nonexistent');

    mockAudios.forEach(audio => {
      expect(audio.play).not.toHaveBeenCalled();
    });
  });

  test('unlock preloads sounds', () => {
    const player = createSoundPlayer(MockAudioClass);
    player.unlock();

    expect(mockAudios.length).toBe(7);
  });

  test('unlock only runs once', () => {
    const player = createSoundPlayer(MockAudioClass);
    player.unlock();
    player.unlock();

    // Should only create audio elements once
    expect(mockAudios.length).toBe(7);
  });

  test('mute state can be toggled', () => {
    const player = createSoundPlayer(MockAudioClass);

    expect(player.isMuted()).toBe(false);
    player.setMuted(true);
    expect(player.isMuted()).toBe(true);
    player.setMuted(false);
    expect(player.isMuted()).toBe(false);
  });

  test('can play thud sound', () => {
    const player = createSoundPlayer(MockAudioClass);
    player.preload();

    player.play('thud');

    const thudAudio = mockAudios.find(a => a.src.includes('thud'));
    expect(thudAudio.play).toHaveBeenCalled();
  });
});
