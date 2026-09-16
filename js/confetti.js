// Confetti for celebrating a new personal highscore.
// Pure state plus a small renderer - the physics is what the tests cover.

export const CONFETTI_COLORS = [
  '#FFD700', '#FF6B6B', '#4CAF50', '#42A5F5',
  '#FF9F1C', '#AB47BC', '#26C6DA', '#FFFFFF'
];

const GRAVITY = 0.09;
const DRAG = 0.992;
const MAX_PIECES = 600;
const DEFAULT_LIFE = 150;   // frames at 60fps (2.5s)
const FADE_FRAMES = 40;     // how long the fade-out at the end of life takes

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function createConfetti() {
  let pieces = [];

  return {
    /**
     * Throws a burst of confetti from one point.
     * angle is in radians (-PI/2 is straight up), spread widens the cone.
     */
    burst({
      x = 0,
      y = 0,
      count = 60,
      angle = -Math.PI / 2,
      spread = Math.PI / 3,
      speed = 6,
      life = DEFAULT_LIFE
    } = {}) {
      for (let i = 0; i < count; i++) {
        const direction = angle + randomBetween(-spread / 2, spread / 2);
        const velocity = speed * randomBetween(0.45, 1.15);

        pieces.push({
          x,
          y,
          vx: Math.cos(direction) * velocity,
          vy: Math.sin(direction) * velocity,
          width: randomBetween(5, 10),
          height: randomBetween(8, 14),
          rotation: randomBetween(0, Math.PI * 2),
          spin: randomBetween(-0.22, 0.22),
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          life,
          age: 0,
          alpha: 1
        });
      }

      // Keep the newest pieces if something bursts far too often.
      if (pieces.length > MAX_PIECES) {
        pieces = pieces.slice(pieces.length - MAX_PIECES);
      }
    },

    // dt is the frame-rate normalised delta (1.0 at 60fps).
    update(dt = 1) {
      if (pieces.length === 0) return;

      const drag = DRAG ** dt;

      pieces.forEach(piece => {
        piece.vy += GRAVITY * dt;
        piece.vx *= drag;
        piece.vy *= drag;
        piece.x += piece.vx * dt;
        piece.y += piece.vy * dt;
        piece.rotation += piece.spin * dt;
        piece.age += dt;

        const remaining = piece.life - piece.age;
        piece.alpha = remaining < FADE_FRAMES ? Math.max(0, remaining / FADE_FRAMES) : 1;
      });

      pieces = pieces.filter(piece => piece.age < piece.life);
    },

    render(ctx) {
      pieces.forEach(piece => {
        ctx.save();
        ctx.globalAlpha = piece.alpha;
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;
        // Squashing the height with the spin makes the pieces look like they
        // are tumbling in three dimensions.
        ctx.fillRect(
          -piece.width / 2,
          -piece.height / 2,
          piece.width,
          piece.height * Math.abs(Math.cos(piece.rotation))
        );
        ctx.restore();
      });

      ctx.globalAlpha = 1;
    },

    getPieces() {
      return pieces;
    },

    count() {
      return pieces.length;
    },

    isActive() {
      return pieces.length > 0;
    },

    clear() {
      pieces = [];
    }
  };
}
