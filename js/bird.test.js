import { describe, test, expect } from 'vitest';
import { createBird, HURT_FLASH_FRAMES } from './bird.js';
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

describe('Bird hurt blink', () => {
  test('starts unhurt and not blinking', () => {
    const bird = createBird();
    expect(bird.isHurt).toBe(false);
    expect(bird.isBlinkingRed()).toBe(false);
    expect(bird.redTint()).toBe(0);
  });

  test('a wrong answer blinks the avatar red without bouncing or shielding it', () => {
    const bird = createBird();
    bird.velocity = 1.5;
    bird.hurtFlash();
    expect(bird.isHurt).toBe(true);
    expect(bird.isBlinkingRed()).toBe(true);
    expect(bird.velocity).toBe(1.5);   // a wrong answer does not knock the bird around
    expect(bird.canBeHurt()).toBe(true); // and gives no free pass through the next pipe
  });

  test('the blink alternates on and off a few times', () => {
    const bird = createBird();
    bird.hurtFlash();
    const phases = [];
    for (let i = 0; i < HURT_FLASH_FRAMES; i++) {
      phases.push(bird.isBlinkingRed());
      bird.update();
    }
    // at least two visible pulses, separated by gaps
    const pulses = phases.filter((on, i) => on && !phases[i - 1]).length;
    expect(pulses).toBeGreaterThanOrEqual(2);
    expect(phases).toContain(false);
  });

  test('the blink is over well before the next pipe arrives', () => {
    const bird = createBird();
    bird.hurtFlash();
    expect(HURT_FLASH_FRAMES).toBeLessThanOrEqual(45); // < 0.75 s at 60fps
    for (let i = 0; i < HURT_FLASH_FRAMES; i++) bird.update();
    expect(bird.isBlinkingRed()).toBe(false);
    expect(bird.isHurt).toBe(false);
    expect(bird.redTint()).toBe(0);
  });

  test('a pipe hit uses the same red blink, so both hurts look alike', () => {
    const bird = createBird();
    bird.bounce();
    expect(bird.isBlinkingRed()).toBe(true);
    expect(bird.canBeHurt()).toBe(false); // pipe hits still grant the invulnerability window
  });

  test('a wrong answer during a pipe-hit blink never shortens it', () => {
    const bird = createBird();
    bird.bounce();
    for (let i = 0; i < 10; i++) bird.update();
    const left = bird.flashTimer;
    bird.hurtFlash(5);
    expect(bird.flashTimer).toBe(left); // the longer of the two wins - one flash, not two
  });

  test('a repeated wrong answer restarts the blink', () => {
    const bird = createBird();
    bird.hurtFlash();
    for (let i = 0; i < 10; i++) bird.update();
    bird.hurtFlash();
    expect(bird.flashTimer).toBe(HURT_FLASH_FRAMES);
  });

  test('reset clears the blink so it never leaks into the next run', () => {
    const bird = createBird();
    bird.hurtFlash();
    bird.reset();
    expect(bird.isBlinkingRed()).toBe(false);
    expect(bird.flashTimer).toBe(0);
    expect(bird.isHurt).toBe(false);
  });

  test('the tint is strong enough to read but never hides the avatar', () => {
    const bird = createBird();
    bird.hurtFlash();
    const tint = bird.redTint();
    expect(tint).toBeGreaterThan(0.3);
    expect(tint).toBeLessThanOrEqual(0.75);
  });
});
