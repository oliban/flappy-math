import { GRAVITY, FLAP_VELOCITY, BIRD_X, BIRD_SIZE, BASE_HEIGHT, GROUND_Y } from './constants.js';

import { getAvatar, DEFAULT_AVATAR_ID } from './avatars.js';
import { drawAvatarSprite, drawAvatarSpriteTint } from './avatar-sprites.js';

// One hurt look for the whole game: the avatar blinks red. A wrong answer sets
// it off without touching the bird's flight, a pipe hit sets it off along with
// the bounce and the invulnerability window, so the two never fight.
export const HURT_FLASH_FRAMES = 30;   // 0.5 s - over long before the next pipe
const BLINK_PERIOD = 5;                // frames per on/off half-pulse -> 3 blinks
const TINT_STRENGTH = 0.72;            // unmistakably red, but the eyes and shape still read

export function createBird() {
  const initialY = BASE_HEIGHT / 2;

  const bird = {
    x: BIRD_X,
    y: initialY,
    velocity: 0,
    size: BIRD_SIZE,
    rotation: 0,
    targetRotation: 0,
    wingPhase: 0,
    bounceTimer: 0,
    flashTimer: 0,
    isHurt: false,
    avatarId: DEFAULT_AVATAR_ID,

    setAvatar(id) {
      if (getAvatar(id).id === id) {
        this.avatarId = id;
      }
    },

    update() {
      this.velocity += GRAVITY;
      this.y += this.velocity;

      // Update bounce timer (invulnerability) and the red hurt blink
      if (this.bounceTimer > 0) {
        this.bounceTimer--;
      }
      if (this.flashTimer > 0) {
        this.flashTimer--;
        if (this.flashTimer === 0) {
          this.isHurt = false;
        }
      }

      // Smooth rotation based on velocity
      // Nose up when going up, nose down when falling
      this.targetRotation = Math.min(Math.max(this.velocity * 0.4, -1.3), 2.2);
      this.rotation += (this.targetRotation - this.rotation) * 0.25;

      // Wing flap animation
      this.wingPhase += 0.15;

      // Keep bird within screen bounds
      if (this.y < this.size / 2) {
        this.y = this.size / 2;
      }
      if (this.y > GROUND_Y - this.size / 2) {
        this.y = GROUND_Y - this.size / 2;
      }
    },

    flap() {
      this.velocity = FLAP_VELOCITY;
      this.wingPhase = 0; // Reset wing animation on flap
    },

    bounce(direction = 'auto') {
      // Bounce in opposite direction of movement
      if (direction === 'auto') {
        // If falling (positive velocity), bounce up. If rising, bounce down.
        if (this.velocity >= 0) {
          this.velocity = -2.2; // Bounce up
        } else {
          this.velocity = 2.2; // Bounce down
        }
      } else if (direction === 'up') {
        this.velocity = -2.2;
      } else if (direction === 'down') {
        this.velocity = 2.2;
      }
      this.bounceTimer = HURT_FLASH_FRAMES; // brief shield; no blink by itself
    },

    // Blink the avatar red. Only when a life is lost (wrong answer, head-on pipe,
    // floor/ceiling): harmless edge bounces stay silent so the blink never
    // competes with the correct-answer rewards.
    hurtFlash(frames = HURT_FLASH_FRAMES) {
      this.flashTimer = Math.max(this.flashTimer, frames);
      this.isHurt = true;
    },

    isBlinkingRed() {
      // Blocks of BLINK_PERIOD frames, starting lit: on-off-on-off-on-off
      return this.flashTimer > 0 &&
        Math.floor((this.flashTimer - 1) / BLINK_PERIOD) % 2 === 1;
    },

    // How much red to lay over the avatar this frame (0 = none)
    redTint() {
      return this.isBlinkingRed() ? TINT_STRENGTH : 0;
    },

    // Floor/ceiling contact: always push away so the bird can never get pinned.
    // Returns true when this contact should cost a life (not already hurt).
    hitFloor() {
      this.y = GROUND_Y - this.size / 2;
      const hurt = this.canBeHurt();
      if (hurt) {
        this.bounce('up');
        this.hurtFlash();
      } else {
        this.velocity = Math.min(this.velocity, -2.2);
      }
      return hurt;
    },

    hitCeiling() {
      this.y = this.size / 2;
      const hurt = this.canBeHurt();
      if (hurt) {
        this.bounce('down');
        this.hurtFlash();
      } else {
        this.velocity = Math.max(this.velocity, 2.2);
      }
      return hurt;
    },

    isOnFloor() {
      return this.y >= GROUND_Y - this.size / 2;
    },

    isOnCeiling() {
      return this.y <= this.size / 2;
    },

    canBeHurt() {
      return this.bounceTimer === 0;
    },

    reset() {
      this.y = initialY;
      this.velocity = 0;
      this.rotation = 0;
      this.targetRotation = 0;
      this.wingPhase = 0;
      this.bounceTimer = 0;
      this.flashTimer = 0;
      this.isHurt = false;
    },

    render(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      drawAvatarSprite(ctx, this.avatarId, this.size / 2, this.wingPhase);

      // Hurt blink: a red wash over the avatar's own pixels
      const tint = this.redTint();
      if (tint > 0) {
        drawAvatarSpriteTint(ctx, this.avatarId, this.size / 2, this.wingPhase, tint);
      }

      ctx.restore();
    }
  };

  return bird;
}
