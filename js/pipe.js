import { BASE_HEIGHT, GROUND_Y, PIPE_WIDTH, PIPE_GAP_HEIGHT, PIPE_CAP_HEIGHT } from './constants.js';

// Pre-rendered sprites (built once per page): pipe body strip, caps and the
// answer bubble. Mobile Safari is slow at gradient fills and strokes, but fast
// at drawImage, so each pipe section becomes one or two image blits.
const BUBBLE_W = 68;
const BUBBLE_H = 46;
const BUBBLE_SHADOW = 3;
const CAP_W = PIPE_WIDTH + 10;
const BORDER = '#1F5F3F';

let sprites = null;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function buildSprites() {
  // Body: a 1px-tall strip with the horizontal gradient and side borders; stretched vertically
  const body = makeCanvas(PIPE_WIDTH, 4);
  {
    const c = body.getContext('2d');
    const g = c.createLinearGradient(0, 0, PIPE_WIDTH, 0);
    g.addColorStop(0, '#3FA06B');
    g.addColorStop(0.18, '#7ED99A');
    g.addColorStop(0.5, '#52BC7C');
    g.addColorStop(0.85, '#2F8A58');
    g.addColorStop(1, '#25714A');
    c.fillStyle = g;
    c.fillRect(0, 0, PIPE_WIDTH, 4);
    c.fillStyle = BORDER;
    c.fillRect(0, 0, 2, 4);
    c.fillRect(PIPE_WIDTH - 2, 0, 2, 4);
  }

  // Cap
  const cap = makeCanvas(CAP_W, PIPE_CAP_HEIGHT);
  {
    const c = cap.getContext('2d');
    const g = c.createLinearGradient(0, 0, CAP_W, 0);
    g.addColorStop(0, '#4DB37A');
    g.addColorStop(0.18, '#93E4AC');
    g.addColorStop(0.5, '#62CB8C');
    g.addColorStop(0.85, '#379764');
    g.addColorStop(1, '#2C7D53');
    c.fillStyle = g;
    c.fillRect(0, 0, CAP_W, PIPE_CAP_HEIGHT);
    c.strokeStyle = BORDER;
    c.lineWidth = 2;
    c.strokeRect(1, 1, CAP_W - 2, PIPE_CAP_HEIGHT - 2);
    c.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    c.beginPath();
    c.moveTo(4, 4);
    c.lineTo(4, PIPE_CAP_HEIGHT - 4);
    c.stroke();
  }

  // Answer bubble (with drop shadow baked in)
  const bubble = makeCanvas(BUBBLE_W + BUBBLE_SHADOW + 2, BUBBLE_H + BUBBLE_SHADOW + 2);
  {
    const c = bubble.getContext('2d');
    const radius = 14;
    c.fillStyle = 'rgba(0, 0, 0, 0.2)';
    roundRectPath(c, BUBBLE_SHADOW + 1, BUBBLE_SHADOW + 1, BUBBLE_W, BUBBLE_H, radius);
    c.fill();
    const g = c.createLinearGradient(0, 1, 0, BUBBLE_H + 1);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(1, '#F1F4FA');
    c.fillStyle = g;
    roundRectPath(c, 1, 1, BUBBLE_W, BUBBLE_H, radius);
    c.fill();
    c.strokeStyle = '#C9D1E3';
    c.lineWidth = 2;
    roundRectPath(c, 1, 1, BUBBLE_W, BUBBLE_H, radius);
    c.stroke();
  }

  sprites = { body, cap, bubble };
}

function roundRectPath(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function ensureSprites() {
  if (!sprites) buildSprites();
}

// Particle object pool (reuse particles to avoid allocation)
const particlePool = [];
const POOL_SIZE = 100;

function getParticle() {
  return particlePool.pop() || { x: 0, y: 0, vx: 0, vy: 0, size: 0, color: '', life: 0 };
}

function releaseParticle(p) {
  if (particlePool.length < POOL_SIZE) {
    particlePool.push(p);
  }
}

export function createPipe(answers, canvasWidth) {
  // Distribute 3 gaps evenly across screen height
  const gapSpacing = BASE_HEIGHT / 4;

  const gaps = answers.map((answer, index) => ({
    answer,
    y: gapSpacing * (index + 1),
    height: PIPE_GAP_HEIGHT,
    hit: false,
    hitResult: null, // 'correct' or 'wrong'
    explosionParticles: [],
    fadeOpacity: 1
  }));

  const pipe = {
    x: canvasWidth,
    width: PIPE_WIDTH,
    gaps,
    passed: false,
    damagedPlayer: false, // Prevents multiple head-on damage from same pipe

    update(speed) {
      this.x -= speed;

      // Update gap animations
      this.gaps.forEach(gap => {
        if (gap.hit) {
          if (gap.hitResult === 'correct') {
            // Fade out correct answer
            gap.fadeOpacity = Math.max(0, gap.fadeOpacity - 0.15);
          } else if (gap.hitResult === 'wrong') {
            // Update explosion particles (in-place removal, return to pool)
            for (let i = gap.explosionParticles.length - 1; i >= 0; i--) {
              const p = gap.explosionParticles[i];
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.3; // gravity
              p.life -= 0.03;
              p.size *= 0.96;
              if (p.life <= 0) {
                releaseParticle(p);
                gap.explosionParticles.splice(i, 1);
              }
            }
          }
        }
      });
    },

    markGapHit(answer, isCorrect) {
      const gap = this.gaps.find(g => g.answer === answer);
      if (gap) {
        gap.hit = true;
        gap.hitResult = isCorrect ? 'correct' : 'wrong';

        if (!isCorrect) {
          // Create explosion particles from pool
          const bubbleX = this.x + this.width / 2;
          const colors = ['#FF4444', '#FF6644', '#FFAA44', '#FFDD44', '#FF8844'];
          for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.3;
            const speed = 3 + Math.random() * 4;
            const p = getParticle();
            p.x = bubbleX;
            p.y = gap.y;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed - 2;
            p.size = 6 + Math.random() * 6;
            p.color = colors[Math.floor(Math.random() * colors.length)];
            p.life = 1;
            gap.explosionParticles.push(p);
          }
        }
      }
    },

    isOffScreen() {
      return this.x < -this.width;
    },

    markPassed() {
      this.passed = true;
    },

    render(ctx) {
      ensureSprites();
      const capWidth = this.width + 10;
      const capOffset = (capWidth - this.width) / 2;
      // Round to integer for Safari performance (avoid sub-pixel antialiasing)
      const pipeX = Math.round(this.x);

      // Draw each pipe section with Flappy Bird style
      this.gaps.forEach((gap, index) => {
        const gapTop = gap.y - gap.height / 2;
        const gapBottom = gap.y + gap.height / 2;

        // Pipe coming DOWN from above (or from previous gap)
        let pipeTopStart = index === 0 ? 0 : this.gaps[index - 1].y + this.gaps[index - 1].height / 2;
        let pipeTopEnd = gapTop;

        if (pipeTopEnd > pipeTopStart) {
          this.drawPipeSection(ctx, pipeX, pipeTopStart, pipeTopEnd, 'down', capWidth, capOffset);
        }

        // Draw answer bubble in gap
        this.drawAnswerBubble(ctx, pipeX, gap);
      });

      // Draw final pipe section going DOWN to bottom
      const lastGap = this.gaps[this.gaps.length - 1];
      const finalStart = lastGap.y + lastGap.height / 2;
      if (finalStart < GROUND_Y) {
        this.drawPipeSection(ctx, pipeX, finalStart, GROUND_Y, 'up', capWidth, capOffset);
      }
    },

    drawPipeSection(ctx, pipeX, top, bottom, capPosition, capWidth, capOffset) {
      const height = bottom - top;
      if (height <= 0) return;
      const t = Math.round(top);
      const h = Math.round(height);

      // Body strip stretched to the section height
      ctx.drawImage(sprites.body, pipeX, t, this.width, h);

      // Plain end gets a thin dark rim
      ctx.fillStyle = BORDER;
      if (capPosition === 'down') {
        ctx.fillRect(pipeX, t, this.width, 2);
      } else {
        ctx.fillRect(pipeX, t + h - 2, this.width, 2);
      }

      // Cap at the gap edge
      const capY = capPosition === 'down' ? t + h - PIPE_CAP_HEIGHT : t;
      ctx.drawImage(sprites.cap, pipeX - capOffset, capY);
    },

    drawAnswerBubble(ctx, pipeX, gap) {
      // Don't render if correct answer has faded out
      if (gap.hit && gap.hitResult === 'correct' && gap.fadeOpacity <= 0) {
        return;
      }

      // Render explosion particles for wrong answers
      if (gap.hit && gap.hitResult === 'wrong') {
        const particles = gap.explosionParticles;
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(Math.round(p.x), Math.round(p.y), p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        // Don't draw bubble after explosion starts
        return;
      }

      const bubbleX = Math.round(pipeX + this.width / 2 - BUBBLE_W / 2);
      const bubbleY = Math.round(gap.y - BUBBLE_H / 2);

      // Apply fade for correct answers
      if (gap.hit && gap.hitResult === 'correct') {
        ctx.globalAlpha = gap.fadeOpacity;
      }

      ctx.drawImage(sprites.bubble, bubbleX - 1, bubbleY - 1);

      // Answer text
      ctx.fillStyle = '#1F2A44';
      ctx.font = "700 26px 'Fredoka', 'Nunito', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gap.answer.toString(), pipeX + this.width / 2, gap.y);

      // Reset alpha
      ctx.globalAlpha = 1;
    },

    roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    },

    renderDebugHitbox(ctx) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Draw pipe hitbox (full width)
      ctx.strokeRect(this.x, 0, this.width, BASE_HEIGHT);

      // Draw gap hitboxes in green
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      this.gaps.forEach(gap => {
        const gapTop = gap.y - gap.height / 2;
        ctx.strokeRect(this.x, gapTop, this.width, gap.height);
      });

      // Draw pipe solid sections in red
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';

      // Top section
      const firstGapTop = this.gaps[0].y - this.gaps[0].height / 2;
      if (firstGapTop > 0) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(this.x, 0, this.width, firstGapTop);
      }

      // Middle sections (between gaps)
      for (let i = 0; i < this.gaps.length - 1; i++) {
        const currentGapBottom = this.gaps[i].y + this.gaps[i].height / 2;
        const nextGapTop = this.gaps[i + 1].y - this.gaps[i + 1].height / 2;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(this.x, currentGapBottom, this.width, nextGapTop - currentGapBottom);
      }

      // Bottom section
      const lastGapBottom = this.gaps[this.gaps.length - 1].y + this.gaps[this.gaps.length - 1].height / 2;
      if (lastGapBottom < BASE_HEIGHT) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(this.x, lastGapBottom, this.width, BASE_HEIGHT - lastGapBottom);
      }

      ctx.setLineDash([]);
    }
  };

  return pipe;
}
