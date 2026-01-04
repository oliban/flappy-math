import { GRAVITY, FLAP_VELOCITY, BIRD_X, BIRD_SIZE, CANVAS_HEIGHT } from './constants.js';

export function createBird() {
  const initialY = CANVAS_HEIGHT / 2;

  const bird = {
    x: BIRD_X,
    y: initialY,
    velocity: 0,
    size: BIRD_SIZE,
    rotation: 0,
    targetRotation: 0,
    wingPhase: 0,
    bounceTimer: 0,
    isHurt: false,

    update() {
      this.velocity += GRAVITY;
      this.y += this.velocity;

      // Update bounce timer
      if (this.bounceTimer > 0) {
        this.bounceTimer--;
        if (this.bounceTimer === 0) {
          this.isHurt = false;
        }
      }

      // Smooth rotation based on velocity
      // Nose up when going up, nose down when falling
      this.targetRotation = Math.min(Math.max(this.velocity * 0.1, -0.5), 1.2);
      this.rotation += (this.targetRotation - this.rotation) * 0.1;

      // Wing flap animation
      this.wingPhase += 0.15;

      // Keep bird within screen bounds
      if (this.y < this.size / 2) {
        this.y = this.size / 2;
      }
      if (this.y > CANVAS_HEIGHT - this.size / 2) {
        this.y = CANVAS_HEIGHT - this.size / 2;
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

      const r = this.size / 2;

      // Body shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.beginPath();
      ctx.ellipse(2, 2, r, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body gradient
      const bodyGradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
      bodyGradient.addColorStop(0, '#FFE566');
      bodyGradient.addColorStop(0.7, '#FFD700');
      bodyGradient.addColorStop(1, '#E5A800');

      ctx.fillStyle = bodyGradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body outline
      ctx.strokeStyle = '#CC8800';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Wing
      const wingOffset = Math.sin(this.wingPhase) * 5;
      ctx.fillStyle = '#E5C100';
      ctx.beginPath();
      ctx.ellipse(-5, wingOffset, r * 0.5, r * 0.35, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#CC8800';
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
      ctx.fillStyle = '#FF6B35';
      ctx.beginPath();
      ctx.moveTo(r * 0.7, r * 0.1);
      ctx.lineTo(r * 1.3, r * 0.25);
      ctx.lineTo(r * 0.7, r * 0.45);
      ctx.closePath();
      ctx.fill();

      // Beak line
      ctx.strokeStyle = '#CC4400';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r * 0.7, r * 0.28);
      ctx.lineTo(r * 1.2, r * 0.25);
      ctx.stroke();

      ctx.restore();
    }
  };

  return bird;
}
