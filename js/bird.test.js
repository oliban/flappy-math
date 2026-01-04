import { describe, test, expect } from 'vitest';
import { createBird } from './bird.js';
import { GRAVITY, FLAP_VELOCITY, BIRD_X, BASE_HEIGHT } from './constants.js';

describe('Bird', () => {
  test('starts at initial position', () => {
    const bird = createBird();
    expect(bird.x).toBe(BIRD_X);
    expect(bird.y).toBe(BASE_HEIGHT / 2);
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
    bird.y = BASE_HEIGHT - 10;
    bird.velocity = 20;
    bird.update();
    expect(bird.y).toBeLessThanOrEqual(BASE_HEIGHT);
  });

  test('reset returns bird to initial state', () => {
    const bird = createBird();
    bird.y = 100;
    bird.velocity = 5;
    bird.reset();
    expect(bird.y).toBe(BASE_HEIGHT / 2);
    expect(bird.velocity).toBe(0);
  });

  test('dt=0.5 produces half the movement of dt=1', () => {
    const bird1 = createBird();
    const bird2 = createBird();

    // Update at 60fps (dt=1)
    bird1.update(1, 16.667);
    const velocity60 = bird1.velocity;
    const y60 = bird1.y;

    // Update at 120fps (dt=0.5)
    bird2.update(0.5, 8.333);
    const velocity120 = bird2.velocity;
    const y120 = bird2.y;

    // At half dt, should get half the change
    expect(velocity120).toBeCloseTo(velocity60 / 2, 5);
  });

  test('two dt=0.5 updates equal one dt=1 update', () => {
    const bird1 = createBird();
    const bird2 = createBird();

    // One 60fps frame
    bird1.update(1, 16.667);

    // Two 120fps frames
    bird2.update(0.5, 8.333);
    bird2.update(0.5, 8.333);

    // Should be approximately equal (small floating point differences ok)
    expect(bird2.velocity).toBeCloseTo(bird1.velocity, 4);
    expect(bird2.y).toBeCloseTo(bird1.y, 4);
  });
});
