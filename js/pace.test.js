import { describe, test, expect } from 'vitest';
import { crossingSeconds, pipeSpeedFor, STEPS_PER_SECOND } from './pace.js';

describe('pace', () => {
  test('level 1 lets a pipe cross the screen in about 16 seconds', () => {
    expect(crossingSeconds(1)).toBeCloseTo(16, 0);
  });

  test('level 10 is roughly twice as fast as level 1', () => {
    expect(crossingSeconds(10)).toBeGreaterThan(6);
    expect(crossingSeconds(10)).toBeLessThan(9);
  });

  test('higher levels cross faster, but never below the floor', () => {
    let prev = crossingSeconds(1);
    for (let level = 2; level <= 60; level++) {
      const c = crossingSeconds(level);
      expect(c).toBeLessThanOrEqual(prev);
      expect(c).toBeGreaterThanOrEqual(2.5);
      prev = c;
    }
    expect(crossingSeconds(60)).toBeCloseTo(2.5, 5);
  });

  test('speed in px per step scales with canvas width so the crossing time is the same everywhere', () => {
    for (const width of [800, 1067, 1796]) {
      const speed = pipeSpeedFor(3, width);
      const seconds = width / speed / STEPS_PER_SECOND;
      expect(seconds).toBeCloseTo(crossingSeconds(3), 5);
    }
  });

  test('a phone-shaped canvas moves pipes faster in pixels than a tablet canvas', () => {
    expect(pipeSpeedFor(1, 1796)).toBeGreaterThan(pipeSpeedFor(1, 800));
  });
});
