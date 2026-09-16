import { GRAVITY, FLAP_VELOCITY, BIRD_X, BIRD_SIZE, BASE_HEIGHT } from './constants.js';
import { SKINS } from './skins.js';

export const DEFAULT_BIRD_COLORS = SKINS[0].colors;

// Cached bird body gradient (recreated when the context, skin or size changes)
let cachedBirdGradient = null;
let gradientKey = null;
let gradientCtx = null;

function getBirdGradient(ctx, colors, radius) {
  const key = `${colors.bodyLight}|${colors.body}|${colors.bodyDark}|${radius}`;
  if (gradientCtx === ctx && gradientKey === key && cachedBirdGradient) {
    return cachedBirdGradient;
  }

  gradientCtx = ctx;
  gradientKey = key;
  cachedBirdGradient = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
  cachedBirdGradient.addColorStop(0, colors.bodyLight);
  cachedBirdGradient.addColorStop(0.7, colors.body);
  cachedBirdGradient.addColorStop(1, colors.bodyDark);
  return cachedBirdGradient;
}

// Draws the bird shape at the current transform origin. Shared by the in-game
// bird and the skin previews in the menu.
export function drawBirdShape(ctx, size, colors = DEFAULT_BIRD_COLORS, wingOffset = 0) {
  const r = size / 2;

  // Body shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(2, 2, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body with cached gradient
  ctx.fillStyle = getBirdGradient(ctx, colors, r);
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body outline
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Wing
  ctx.fillStyle = colors.wing;
  ctx.beginPath();
  ctx.ellipse(-5, wingOffset, r * 0.5, r * 0.35, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Eye white
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(r * 0.35, -r * 0.15, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Eye pupil
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(r * 0.45, -r * 0.1, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlight
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(r * 0.5, -r * 0.2, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = colors.beak;
  ctx.beginPath();
  ctx.moveTo(r * 0.7, r * 0.1);
  ctx.lineTo(r * 1.3, r * 0.25);
  ctx.lineTo(r * 0.7, r * 0.45);
  ctx.closePath();
  ctx.fill();

  // Beak line
  ctx.strokeStyle = colors.beakDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r * 0.7, r * 0.28);
  ctx.lineTo(r * 1.2, r * 0.25);
  ctx.stroke();
}

export function createBird(colors = DEFAULT_BIRD_COLORS) {
  const initialY = BASE_HEIGHT / 2;

  const bird = {
    x: BIRD_X,
    y: initialY,
    velocity: 0,
    size: BIRD_SIZE,
    rotation: 0,
    targetRotation: 0,
    wingPhase: 0,
    bounceTime: 0, // ms remaining in bounce/hurt state
    isHurt: false,
    colors,

    setColors(newColors) {
      if (newColors) this.colors = newColors;
    },

    update(dt = 1, deltaTime = 16.667) {
      this.velocity += GRAVITY * dt;
      this.y += this.velocity * dt;

      // Update bounce timer (time-based)
      if (this.bounceTime > 0) {
        this.bounceTime -= deltaTime;
        if (this.bounceTime <= 0) {
          this.bounceTime = 0;
          this.isHurt = false;
        }
      }

      // Smooth rotation based on velocity
      // Nose up when going up, nose down when falling
      this.targetRotation = Math.min(Math.max(this.velocity * 0.4, -1.3), 2.2);
      this.rotation += (this.targetRotation - this.rotation) * 0.25 * dt;

      // Wing flap animation
      this.wingPhase += 0.15 * dt;

      // Keep bird within screen bounds
      if (this.y < this.size / 2) {
        this.y = this.size / 2;
      }
      if (this.y > BASE_HEIGHT - this.size / 2) {
        this.y = BASE_HEIGHT - this.size / 2;
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
          this.velocity = -1.5; // Bounce up
        } else {
          this.velocity = 1.5; // Bounce down
        }
      } else if (direction === 'up') {
        this.velocity = -1.5;
      } else if (direction === 'down') {
        this.velocity = 1.5;
      }
      this.bounceTimer = 30;
      this.isHurt = true;
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
      this.isHurt = false;
    },

    render(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      // Flash red when hurt
      if (this.isHurt && Math.floor(this.bounceTimer / 4) % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }

      drawBirdShape(ctx, this.size, this.colors, Math.sin(this.wingPhase) * 5);

      ctx.restore();
    }
  };

  return bird;
}
