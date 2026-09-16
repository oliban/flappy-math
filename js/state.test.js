import { describe, test, expect } from 'vitest';
import { createGameState, STATES } from './state.js';

describe('Game State Machine', () => {
  test('starts in menu state', () => {
    const state = createGameState();
    expect(state.current()).toBe(STATES.MENU);
  });

  test('transitions from menu to playing', () => {
    const state = createGameState();
    state.startGame();
    expect(state.current()).toBe(STATES.PLAYING);
  });

  test('transitions from playing to gameOver', () => {
    const state = createGameState();
    state.startGame();
    state.endGame();
    expect(state.current()).toBe(STATES.GAME_OVER);
  });

  test('transitions from gameOver back to menu', () => {
    const state = createGameState();
    state.startGame();
    state.endGame();
    state.returnToMenu();
    expect(state.current()).toBe(STATES.MENU);
  });

  test('cannot transition from menu directly to gameOver', () => {
    const state = createGameState();
    state.endGame(); // should be ignored
    expect(state.current()).toBe(STATES.MENU);
  });

  test('cannot start game while already playing', () => {
    const state = createGameState();
    state.startGame();
    state.startGame(); // should be ignored
    expect(state.current()).toBe(STATES.PLAYING);
  });
});

describe('Profile and highscore screens', () => {
  test('menu can open profile and return', () => {
    const state = createGameState();
    state.openProfile();
    expect(state.current()).toBe(STATES.PROFILE);
    state.returnToMenu();
    expect(state.current()).toBe(STATES.MENU);
  });

  test('menu can open highscores and return', () => {
    const state = createGameState();
    state.openHighscores();
    expect(state.current()).toBe(STATES.HIGHSCORES);
    state.returnToMenu();
    expect(state.current()).toBe(STATES.MENU);
  });

  test('game over can open highscores', () => {
    const state = createGameState();
    state.startGame();
    state.endGame();
    state.openHighscores();
    expect(state.current()).toBe(STATES.HIGHSCORES);
  });

  test('cannot start a game from the profile screen', () => {
    const state = createGameState();
    state.openProfile();
    state.startGame();
    expect(state.current()).toBe(STATES.PROFILE);
  });
});

describe('Gallery screen', () => {
  test('menu can open the gallery and return', () => {
    const state = createGameState();
    state.openGallery();
    expect(state.current()).toBe(STATES.GALLERY);
    state.returnToMenu();
    expect(state.current()).toBe(STATES.MENU);
  });

  test('gallery cannot be opened mid-game', () => {
    const state = createGameState();
    state.startGame();
    state.openGallery();
    expect(state.current()).toBe(STATES.PLAYING);
  });
});
