import { CANVAS_WIDTH, CANVAS_HEIGHT, PIPE_WIDTH, PIPE_GAP_HEIGHT, PIPE_CAP_HEIGHT } from './constants.js';

export function createPipe(answers) {
  // Distribute 3 gaps evenly across screen height
  const gapSpacing = CANVAS_HEIGHT / 4;

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
    x: CANVAS_WIDTH,
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
            // Update explosion particles
            gap.explosionParticles.forEach(p => {
              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.3; // gravity
              p.life -= 0.03;
              p.size *= 0.96;
            });
            gap.explosionParticles = gap.explosionParticles.filter(p => p.life > 0);
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
          // Create explosion particles
          const bubbleX = this.x + this.width / 2;
          const colors = ['#FF4444', '#FF6644', '#FFAA44', '#FFDD44', '#FF8844'];
          for (let i = 0; i < 20; i++) {
            const angle = (Math.PI * 2 * i) / 20 + Math.random() * 0.3;
            const speed = 3 + Math.random() * 4;
            gap.explosionParticles.push({
              x: bubbleX,
              y: gap.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 2,
              size: 6 + Math.random() * 6,
              color: colors[Math.floor(Math.random() * colors.length)],
              life: 1
            });
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
      const capWidth = this.width + 10;
      const capOffset = (capWidth - this.width) / 2;

      // Draw each pipe section with Flappy Bird style
      this.gaps.forEach((gap, index) => {
        const gapTop = gap.y - gap.height / 2;
        const gapBottom = gap.y + gap.height / 2;

        // Pipe coming DOWN from above (or from previous gap)
        let pipeTopStart = index === 0 ? 0 : this.gaps[index - 1].y + this.gaps[index - 1].height / 2;
        let pipeTopEnd = gapTop;

        if (pipeTopEnd > pipeTopStart) {
          this.drawPipeSection(ctx, pipeTopStart, pipeTopEnd, 'down', capWidth, capOffset);
        }

        // Draw answer bubble in gap
        this.drawAnswerBubble(ctx, gap);
      });

      // Draw final pipe section going DOWN to bottom
      const lastGap = this.gaps[this.gaps.length - 1];
      const finalStart = lastGap.y + lastGap.height / 2;
      if (finalStart < CANVAS_HEIGHT) {
        this.drawPipeSection(ctx, finalStart, CANVAS_HEIGHT, 'up', capWidth, capOffset);
      }
    },

    drawPipeSection(ctx, top, bottom, capPosition, capWidth, capOffset) {
      const height = bottom - top;
      if (height <= 0) return;

      // Main pipe body with gradient
      const gradient = ctx.createLinearGradient(this.x, 0, this.x + this.width, 0);
      gradient.addColorStop(0, '#73BF5E');
      gradient.addColorStop(0.2, '#8CD674');
      gradient.addColorStop(0.5, '#5DAE4A');
      gradient.addColorStop(0.8, '#4A9339');
      gradient.addColorStop(1, '#3D7A2F');

      ctx.fillStyle = gradient;
      ctx.fillRect(this.x, top, this.width, height);

      // Pipe border
      ctx.strokeStyle = '#2D5A1F';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, top, this.width, height);

      // Cap/rim at the gap edge
      const capY = capPosition === 'down' ? bottom - PIPE_CAP_HEIGHT : top;

      // Cap gradient
      const capGradient = ctx.createLinearGradient(this.x - capOffset, 0, this.x + capWidth - capOffset, 0);
      capGradient.addColorStop(0, '#8CD674');
      capGradient.addColorStop(0.2, '#A3E88A');
      capGradient.addColorStop(0.5, '#73BF5E');
      capGradient.addColorStop(0.8, '#5DAE4A');
      capGradient.addColorStop(1, '#4A9339');

      ctx.fillStyle = capGradient;
      ctx.fillRect(this.x - capOffset, capY, capWidth, PIPE_CAP_HEIGHT);

      // Cap border
      ctx.strokeStyle = '#2D5A1F';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x - capOffset, capY, capWidth, PIPE_CAP_HEIGHT);

      // Cap highlight line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x - capOffset + 4, capY + 4);
      ctx.lineTo(this.x - capOffset + 4, capY + PIPE_CAP_HEIGHT - 4);
      ctx.stroke();
    },

    drawAnswerBubble(ctx, gap) {
      // Don't render if correct answer has faded out
      if (gap.hit && gap.hitResult === 'correct' && gap.fadeOpacity <= 0) {
        return;
      }

      // Render explosion particles for wrong answers
      if (gap.hit && gap.hitResult === 'wrong') {
        gap.explosionParticles.forEach(p => {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;

        // Don't draw bubble after explosion starts
        if (gap.explosionParticles.length === 0) return;
        return;
      }

      const bubbleWidth = 60;
      const bubbleHeight = 45;
      const bubbleX = this.x + this.width / 2 - bubbleWidth / 2;
      const bubbleY = gap.y - bubbleHeight / 2;
      const radius = 10;

      // Apply fade for correct answers
      if (gap.hit && gap.hitResult === 'correct') {
        ctx.globalAlpha = gap.fadeOpacity;
      }

      // Bubble shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      this.roundRect(ctx, bubbleX + 3, bubbleY + 3, bubbleWidth, bubbleHeight, radius);
      ctx.fill();

      // Bubble background
      const bubbleGradient = ctx.createLinearGradient(bubbleX, bubbleY, bubbleX, bubbleY + bubbleHeight);
      bubbleGradient.addColorStop(0, '#FFFFFF');
      bubbleGradient.addColorStop(1, '#E8E8E8');
      ctx.fillStyle = bubbleGradient;
      this.roundRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, radius);
      ctx.fill();

      // Bubble border
      ctx.strokeStyle = '#CCCCCC';
      ctx.lineWidth = 2;
      this.roundRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, radius);
      ctx.stroke();

      // Answer text
      ctx.fillStyle = '#333';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gap.answer.toString(), this.x + this.width / 2, gap.y);

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
      ctx.strokeRect(this.x, 0, this.width, CANVAS_HEIGHT);

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
      if (lastGapBottom < CANVAS_HEIGHT) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(this.x, lastGapBottom, this.width, CANVAS_HEIGHT - lastGapBottom);
      }

      ctx.setLineDash([]);
    }
  };

  return pipe;
}
