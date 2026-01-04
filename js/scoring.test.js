import { describe, test, expect } from 'vitest';
import { createScoring } from './scoring.js';
import { INITIAL_LIVES, MASTERY_STREAK } from './constants.js';

describe('Scoring', () => {
  test('starts with initial lives', () => {
    const scoring = createScoring();
    expect(scoring.lives).toBe(INITIAL_LIVES);
  });

  test('starts with zero score and streak', () => {
    const scoring = createScoring();
    expect(scoring.score).toBe(0);
    expect(scoring.streak).toBe(0);
  });

  test('correct answer increments score and streak', () => {
    const scoring = createScoring();
    scoring.correctAnswer();
    expect(scoring.score).toBe(1);
    expect(scoring.streak).toBe(1);
  });

  test('wrong answer loses life and resets streak', () => {
    const scoring = createScoring();
    scoring.correctAnswer();
    scoring.correctAnswer();
    scoring.wrongAnswer();
    expect(scoring.lives).toBe(INITIAL_LIVES - 1);
    expect(scoring.streak).toBe(0);
    expect(scoring.score).toBe(2); // score preserved
  });

  test('hitting pipe loses life and resets streak', () => {
    const scoring = createScoring();
    scoring.correctAnswer();
    scoring.hitPipe();
    expect(scoring.lives).toBe(INITIAL_LIVES - 1);
    expect(scoring.streak).toBe(0);
  });

  test('game over when lives reach zero', () => {
    const scoring = createScoring();
    expect(scoring.isGameOver()).toBe(false);

    scoring.wrongAnswer();
    scoring.wrongAnswer();
    scoring.wrongAnswer();

    expect(scoring.isGameOver()).toBe(true);
    expect(scoring.lives).toBe(0);
  });

  test('mastery achieved at streak threshold', () => {
    const scoring = createScoring();

    for (let i = 0; i < MASTERY_STREAK - 1; i++) {
      scoring.correctAnswer();
      expect(scoring.hasMastered()).toBe(false);
    }

    scoring.correctAnswer();
    expect(scoring.hasMastered()).toBe(true);
    expect(scoring.streak).toBe(MASTERY_STREAK);
  });

  test('reset returns to initial state', () => {
    const scoring = createScoring();
    scoring.correctAnswer();
    scoring.correctAnswer();
    scoring.wrongAnswer();

    scoring.reset();

    expect(scoring.lives).toBe(INITIAL_LIVES);
    expect(scoring.score).toBe(0);
    expect(scoring.streak).toBe(0);
  });
});
