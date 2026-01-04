import { describe, test, expect } from 'vitest';
import { createBird } from './bird.js';
import { GRAVITY, FLAP_VELOCITY, BIRD_X, CANVAS_HEIGHT } from './constants.js';

describe('Bird', () => {
  test('starts at initial position', () => {
    const bird = createBird();
    expect(bird.x).toBe(BIRD_X);
    expect(bird.y).toBe(CANVAS_HEIGHT / 2);
    expect(bird.velocity).toBe(0);
  });

  test('falls due to gravity each update', () => {
    const bird = createBird();
    const initialY = bird.y;
    bird.update();
    expect(bird.velocity).toBe(GRAVITY);
    expect(bird.y).toBeGreaterThan(initialY);
  });

  test('flap applies upward velocity', () => {
    const bird = createBird();
    bird.flap();
    expect(bird.velocity).toBe(FLAP_VELOCITY);
  });

  test('cannot go above ceiling', () => {
    const bird = createBird();
    bird.y = 10;
    bird.velocity = -20;
    bird.update();
    expect(bird.y).toBeGreaterThanOrEqual(0);
  });

  test('cannot go below floor', () => {
    const bird = createBird();
    bird.y = CANVAS_HEIGHT - 10;
    bird.velocity = 20;
    bird.update();
    expect(bird.y).toBeLessThanOrEqual(CANVAS_HEIGHT);
  });

  test('reset returns bird to initial state', () => {
    const bird = createBird();
    bird.y = 100;
    bird.velocity = 5;
    bird.reset();
    expect(bird.y).toBe(CANVAS_HEIGHT / 2);
    expect(bird.velocity).toBe(0);
  });
});
