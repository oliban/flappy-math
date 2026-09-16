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

  test('opens the highscores screen from the menu', () => {
    const state = createGameState();
    state.showHighscores();
    expect(state.current()).toBe(STATES.HIGHSCORES);
  });

  test('opens the highscores screen from game over', () => {
    const state = createGameState();
    state.startGame();
    state.endGame();
    state.showHighscores();
    expect(state.current()).toBe(STATES.HIGHSCORES);
  });

  test('returns to the menu from the highscores screen', () => {
    const state = createGameState();
    state.showHighscores();
    state.returnToMenu();
    expect(state.current()).toBe(STATES.MENU);
  });

  test('cannot open the highscores screen while playing', () => {
    const state = createGameState();
    state.startGame();
    state.showHighscores();
    expect(state.current()).toBe(STATES.PLAYING);
  });

  test('cannot start the game from the highscores screen', () => {
    const state = createGameState();
    state.showHighscores();
    state.startGame();
    expect(state.current()).toBe(STATES.HIGHSCORES);
  });

  test('cannot start game while already playing', () => {
    const state = createGameState();
    state.startGame();
    state.startGame(); // should be ignored
    expect(state.current()).toBe(STATES.PLAYING);
  });
});
