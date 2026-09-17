import { HITS_PER_SPEED_LEVEL } from './constants.js';

// A single play session: which table, how fast, and how the mode reacts to answers.

export const MODES = {
  DAILY: 'daily',       // Table of the day, speed ramps per correct answers
  PRACTICE: 'practice'  // Player picks table and speed, ends on mastery
};

export function createRun({ mode, table, speed = 1 }) {
  return {
    mode,
    table,
    speed,
    maxSpeed: speed,
    hitsTowardNextLevel: 0,

    onCorrect() {
      if (this.mode === MODES.DAILY) {
        this.hitsTowardNextLevel++;
        if (this.hitsTowardNextLevel >= HITS_PER_SPEED_LEVEL) {
          this.hitsTowardNextLevel = 0;
          this.speed++;
          this.maxSpeed = Math.max(this.maxSpeed, this.speed);
        }
      }
    },

    onWrong() {
      // Speed is kept; the player loses a life instead
    },

    endsOnMastery() {
      return this.mode === MODES.PRACTICE;
    },

    countsForHighscore() {
      return this.mode === MODES.DAILY;
    }
  };
}
