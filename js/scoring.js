import { INITIAL_LIVES, MASTERY_STREAK } from './constants.js';

export function createScoring() {
  return {
    lives: INITIAL_LIVES,
    score: 0,
    streak: 0,

    correctAnswer() {
      this.score++;
      this.streak++;
    },

    wrongAnswer() {
      this.lives--;
      this.streak = 0;
    },

    hitPipe() {
      this.lives--;
      this.streak = 0;
    },

    isGameOver() {
      return this.lives <= 0;
    },

    hasMastered() {
      return this.streak >= MASTERY_STREAK;
    },

    reset() {
      this.lives = INITIAL_LIVES;
      this.score = 0;
      this.streak = 0;
    }
  };
}
