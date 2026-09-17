import { describe, test, expect } from 'vitest';
import { createRun, MODES } from './run.js';
import { HITS_PER_SPEED_LEVEL } from './constants.js';

describe('daily run', () => {
  test('starts at speed 1 with the given table', () => {
    const run = createRun({ mode: MODES.DAILY, table: 7 });
    expect(run.table).toBe(7);
    expect(run.speed).toBe(1);
    expect(run.maxSpeed).toBe(1);
  });

  test('speed stays at 1 until enough correct answers are collected', () => {
    const run = createRun({ mode: MODES.DAILY, table: 7 });
    for (let i = 0; i < HITS_PER_SPEED_LEVEL - 1; i++) run.onCorrect();
    expect(run.speed).toBe(1);
  });

  test('speed rises one level every HITS_PER_SPEED_LEVEL correct answers', () => {
    const run = createRun({ mode: MODES.DAILY, table: 7 });
    for (let i = 0; i < HITS_PER_SPEED_LEVEL; i++) run.onCorrect();
    expect(run.speed).toBe(2);
    for (let i = 0; i < HITS_PER_SPEED_LEVEL; i++) run.onCorrect();
    expect(run.speed).toBe(3);
    expect(run.maxSpeed).toBe(3);
  });

  test('progression is gentle: three levels per nine answers', () => {
    expect(HITS_PER_SPEED_LEVEL).toBeGreaterThanOrEqual(3);
  });

  test('wrong answer keeps the current speed and progress toward the next level', () => {
    const run = createRun({ mode: MODES.DAILY, table: 7 });
    for (let i = 0; i < HITS_PER_SPEED_LEVEL; i++) run.onCorrect();
    run.onCorrect();
    run.onWrong();
    expect(run.speed).toBe(2);
    for (let i = 0; i < HITS_PER_SPEED_LEVEL - 1; i++) run.onCorrect();
    expect(run.speed).toBe(3);
  });

  test('mastery does not end a daily run', () => {
    const run = createRun({ mode: MODES.DAILY, table: 7 });
    expect(run.endsOnMastery()).toBe(false);
  });

  test('daily runs are eligible for the highscore list', () => {
    const run = createRun({ mode: MODES.DAILY, table: 7 });
    expect(run.countsForHighscore()).toBe(true);
  });
});

describe('practice run', () => {
  test('keeps the selected speed on correct answers', () => {
    const run = createRun({ mode: MODES.PRACTICE, table: 4, speed: 5 });
    run.onCorrect();
    expect(run.speed).toBe(5);
    expect(run.maxSpeed).toBe(5);
  });

  test('ends on mastery and does not count for highscores', () => {
    const run = createRun({ mode: MODES.PRACTICE, table: 4, speed: 5 });
    expect(run.endsOnMastery()).toBe(true);
    expect(run.countsForHighscore()).toBe(false);
  });
});
