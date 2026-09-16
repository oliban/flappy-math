import { describe, test, expect } from 'vitest';
import { createBird } from './bird.js';
import { GRAVITY, FLAP_VELOCITY, BIRD_X, BASE_HEIGHT, GROUND_Y } from './constants.js';

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
});

describe('Bird avatar', () => {
  test('uses the bird avatar by default', () => {
    const bird = createBird();
    expect(bird.avatarId).toBe('bird');
  });

  test('can be given another avatar', () => {
    const bird = createBird();
    bird.setAvatar('fox');
    expect(bird.avatarId).toBe('fox');
  });

  test('ignores unknown avatars', () => {
    const bird = createBird();
    bird.setAvatar('dragon');
    expect(bird.avatarId).toBe('bird');
  });
});

describe('Bird ground handling', () => {
  test('floor is the top of the grass, not the canvas bottom', () => {
    const bird = createBird();
    bird.y = GROUND_Y - 5;
    bird.velocity = 50;
    bird.update();
    expect(bird.y).toBe(GROUND_Y - bird.size / 2);
  });

  test('hitting the floor always pushes the bird back up, even while hurt', () => {
    const bird = createBird();
    bird.bounce('up');           // starts the hurt timer
    bird.velocity = 3;
    bird.y = GROUND_Y;
    const hurt = bird.hitFloor();
    expect(hurt).toBe(false);    // no second life lost during the hurt window
    expect(bird.velocity).toBeLessThan(0);
    expect(bird.y).toBe(GROUND_Y - bird.size / 2);
  });

  test('hitting the floor when not hurt reports damage', () => {
    const bird = createBird();
    bird.velocity = 3;
    bird.y = GROUND_Y;
    expect(bird.hitFloor()).toBe(true);
    expect(bird.canBeHurt()).toBe(false);
  });

  test('hitting the ceiling always pushes the bird back down', () => {
    const bird = createBird();
    bird.bounce('down');
    bird.velocity = -3;
    bird.y = 0;
    expect(bird.hitCeiling()).toBe(false);
    expect(bird.velocity).toBeGreaterThan(0);
    expect(bird.y).toBe(bird.size / 2);
  });
});
