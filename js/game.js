import { CANVAS_WIDTH, CANVAS_HEIGHT, BASE_SPEED, SPEED_INCREMENT, PIPE_SPAWN_INTERVAL } from './constants.js';
import { createGameState, STATES } from './state.js';
import { createBird } from './bird.js';
import { createPipe } from './pipe.js';
import { generateProblemForTable } from './math.js';
import { checkCollision, CollisionResult } from './collision.js';
import { createScoring } from './scoring.js';
import { createProgress } from './progress.js';
import { createStorage } from './storage.js';
import { t, setLanguage, getLanguage, getAvailableLanguages, initLanguage } from './i18n.js';

class Game {
  constructor() {
    initLanguage();

    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.state = createGameState();
    this.bird = createBird();
    this.scoring = createScoring();
    this.progress = createProgress();
    this.storage = createStorage();

    this.pipes = [];
    this.currentProblem = null;
    this.selectedTable = 2;
    this.selectedSpeed = 1;
    this.lastPipeSpawn = 0;
    this.showMasteryMessage = false;
    this.fadeOut = 0; // 0 = no fade, increases to 1 over 2 seconds
    this.isFadingOut = false;

    this.loadProgress();
    this.setupCanvas();
    this.setupInput();

    this.lastTime = 0;
    this.gameLoop = this.gameLoop.bind(this);
    requestAnimationFrame(this.gameLoop);
  }

  loadProgress() {
    const saved = this.storage.load();
    if (saved) {
      this.progress.import(saved);
    }
  }

  saveProgress() {
    this.storage.save(this.progress.export());
  }

  setupCanvas() {
    this.canvas.width = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.handleInput();
      }
      // Escape to return to menu
      if (e.code === 'Escape') {
        if (this.state.current() === STATES.PLAYING || this.state.current() === STATES.GAME_OVER) {
          this.state.returnToMenu();
        }
      }

      // Number keys 2-9 for table selection in menu
      if (this.state.current() === STATES.MENU) {
        const num = parseInt(e.key);
        if (num >= 2 && num <= 9) {
          this.selectedTable = num;
        }
        if (e.key === '0') this.selectedTable = 10;
        if (e.key === '-') this.selectedTable = 11;
        if (e.key === '=') this.selectedTable = 12;

        // Arrow keys for table and speed
        if (e.code === 'ArrowLeft') {
          this.selectedTable = Math.max(this.selectedTable - 1, 2);
        }
        if (e.code === 'ArrowRight') {
          this.selectedTable = Math.min(this.selectedTable + 1, 12);
        }
        if (e.code === 'ArrowUp') {
          this.selectedSpeed = Math.min(this.selectedSpeed + 1, 99);
        }
        if (e.code === 'ArrowDown') {
          this.selectedSpeed = Math.max(this.selectedSpeed - 1, 1);
        }
      }
    });

    this.canvas.addEventListener('click', (e) => {
      this.handleClick(e);
    });
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = CANVAS_WIDTH / 2;

    if (this.state.current() === STATES.MENU) {
      // Language selector
      const langs = getAvailableLanguages();
      const langY = 30;
      const langStartX = CANVAS_WIDTH - 100;
      for (let i = 0; i < langs.length; i++) {
        const langX = langStartX + i * 45;
        if (x >= langX - 18 && x <= langX + 18 && y >= langY - 18 && y <= langY + 18) {
          setLanguage(langs[i].code);
          return;
        }
      }

      // Table grid dimensions (must match renderMenu)
      const cardY = 145;
      const cols = 6;
      const cellWidth = 65;
      const cellHeight = 55;
      const gap = 8;
      const gridWidth = cols * cellWidth + (cols - 1) * gap;
      const gridStartX = centerX - gridWidth / 2;
      const gridStartY = cardY + 50;

      for (let i = 0; i < 11; i++) {
        const table = i + 2;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cellX = gridStartX + col * (cellWidth + gap);
        const cellY = gridStartY + row * (cellHeight + gap);

        if (x >= cellX && x <= cellX + cellWidth && y >= cellY && y <= cellY + cellHeight) {
          this.selectedTable = table;
          return;
        }
      }

      // Speed arrows
      const speedCardY = 360;
      if (y >= speedCardY + 40 && y <= speedCardY + 70) {
        if (x >= centerX - 80 && x <= centerX - 40) {
          this.selectedSpeed = Math.max(this.selectedSpeed - 1, 1);
          return;
        }
        if (x >= centerX + 40 && x <= centerX + 80) {
          this.selectedSpeed = Math.min(this.selectedSpeed + 1, 99);
          return;
        }
      }

      // Check if clicking start button
      const btnX = centerX - 110;
      const btnY = 460;
      if (x >= btnX && x <= btnX + 220 && y >= btnY && y <= btnY + 55) {
        this.startGame();
      }
    } else if (this.state.current() === STATES.PLAYING) {
      this.bird.flap();
    } else if (this.state.current() === STATES.GAME_OVER) {
      this.state.returnToMenu();
    }
  }

  handleInput() {
    const currentState = this.state.current();

    if (currentState === STATES.MENU) {
      this.startGame();
    } else if (currentState === STATES.PLAYING) {
      this.bird.flap();
    } else if (currentState === STATES.GAME_OVER) {
      this.state.returnToMenu();
    }
  }

  startGame() {
    this.state.startGame();
    this.bird.reset();
    this.scoring.reset();
    this.pipes = [];
    this.showMasteryMessage = false;
    this.lastPipeSpawn = 0;
    this.fadeOut = 0;
    this.isFadingOut = false;
    this.spawnPipe();
  }

  spawnPipe() {
    this.currentProblem = generateProblemForTable(this.selectedTable);
    const pipe = createPipe(this.currentProblem.answers);
    this.pipes.push(pipe);
  }

  getGameSpeed() {
    return BASE_SPEED + (this.selectedSpeed - 1) * SPEED_INCREMENT;
  }

  gameLoop(timestamp) {
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(deltaTime, timestamp);
    this.render();

    requestAnimationFrame(this.gameLoop);
  }

  update(deltaTime, timestamp) {
    if (this.state.current() !== STATES.PLAYING) return;

    // Update bird
    this.bird.update();

    // Check floor/ceiling collision with bounce
    if (this.bird.y <= this.bird.size / 2) {
      if (this.bird.canBeHurt()) {
        this.bird.bounce('down');
        this.scoring.hitPipe();
        if (this.scoring.isGameOver()) {
          this.startFadeOut();
        }
      }
      this.bird.y = this.bird.size / 2;
    }
    if (this.bird.y >= CANVAS_HEIGHT - this.bird.size / 2) {
      if (this.bird.canBeHurt()) {
        this.bird.bounce('up');
        this.scoring.hitPipe();
        if (this.scoring.isGameOver()) {
          this.startFadeOut();
        }
      }
      this.bird.y = CANVAS_HEIGHT - this.bird.size / 2;
    }

    const speed = this.getGameSpeed();

    // Update pipes
    this.pipes.forEach(pipe => pipe.update(speed));

    // Remove off-screen pipes
    this.pipes = this.pipes.filter(pipe => !pipe.isOffScreen());

    // Spawn new pipe only after current one is passed
    const allPipesPassed = this.pipes.every(pipe => pipe.passed);
    if (allPipesPassed && this.pipes.length === 0 ||
        (allPipesPassed && this.pipes[this.pipes.length - 1].passed)) {
      this.spawnPipe();
    }

    // Check collisions
    for (const pipe of this.pipes) {
      const result = checkCollision(this.bird, pipe);

      // Head-on pipe collision - bounce and lose life (only once per pipe)
      if (result.type === CollisionResult.PIPE) {
        if (this.bird.canBeHurt()) {
          this.bird.bounce();
          // Only lose life if this pipe hasn't already damaged the player
          if (!pipe.damagedPlayer) {
            pipe.damagedPlayer = true;
            this.scoring.hitPipe();
            if (this.scoring.isGameOver()) {
              this.startFadeOut();
            }
          }
        }
      // Edge collision (in gap but edges touching pipe) - bounce only, no life loss
      } else if (result.type === CollisionResult.PIPE_EDGE) {
        if (this.bird.canBeHurt()) {
          this.bird.bounce();
        }
      } else if (result.type === CollisionResult.GAP && !pipe.passed) {
        // Only score gaps on pipes that haven't been passed yet
        pipe.markPassed();
        const isCorrect = result.answer === this.currentProblem.correctAnswer;
        pipe.markGapHit(result.answer, isCorrect);

        if (isCorrect) {
          this.scoring.correctAnswer();

          // Check mastery
          if (this.scoring.hasMastered()) {
            this.progress.updateBestSpeed(this.selectedTable, this.selectedSpeed);
            this.saveProgress();
            this.showMasteryMessage = true;
            this.startFadeOut();
          }
        } else {
          this.scoring.wrongAnswer();
          if (this.scoring.isGameOver()) {
            this.startFadeOut();
          }
        }
      }
    }

    // Update fade-out animation
    if (this.isFadingOut) {
      this.fadeOut += 1 / 120; // 2 seconds at 60fps
      if (this.fadeOut >= 1) {
        this.endGame();
      }
    }
  }

  startFadeOut() {
    if (!this.isFadingOut) {
      this.isFadingOut = true;
      this.fadeOut = 0;
    }
  }

  endGame() {
    this.state.endGame();
    this.isFadingOut = false;
    this.fadeOut = 0;
  }

  render() {
    // Clear canvas with sky gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#E0F6FF');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const currentState = this.state.current();

    if (currentState === STATES.MENU) {
      this.renderMenu();
    } else if (currentState === STATES.PLAYING) {
      this.renderGame();
      // Render fade-out overlay
      if (this.isFadingOut) {
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeOut * 0.8})`;
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    } else if (currentState === STATES.GAME_OVER) {
      this.renderGameOver();
    }
  }

  renderMenu() {
    const ctx = this.ctx;
    const centerX = CANVAS_WIDTH / 2;

    // Language selector (top right)
    const langs = getAvailableLanguages();
    const langY = 30;
    const langStartX = CANVAS_WIDTH - 100;
    langs.forEach((lang, i) => {
      const x = langStartX + i * 45;
      const isSelected = getLanguage() === lang.code;

      if (isSelected) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        this.roundRect(ctx, x - 18, langY - 18, 36, 36, 8);
        ctx.fill();
      }

      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(lang.flag, x, langY + 8);
    });

    // Title with shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.font = 'bold 56px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(t('title'), centerX + 3, 83);

    ctx.fillStyle = '#2D5A1F';
    ctx.fillText(t('title'), centerX, 80);

    // Subtitle
    ctx.fillStyle = '#555';
    ctx.font = '18px system-ui';
    ctx.fillText(t('subtitle'), centerX, 115);

    // Table selection card
    const cardX = centerX - 250;
    const cardY = 145;
    const cardWidth = 500;
    const cardHeight = 200;

    // Card shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.roundRect(ctx, cardX + 4, cardY + 4, cardWidth, cardHeight, 15);
    ctx.fill();

    // Card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15);
    ctx.fill();

    // Card title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(t('selectTable'), centerX, cardY + 30);

    // Table selection grid - centered
    const cols = 6;
    const cellWidth = 65;
    const cellHeight = 55;
    const gap = 8;
    const gridWidth = cols * cellWidth + (cols - 1) * gap;
    const gridStartX = centerX - gridWidth / 2;
    const gridStartY = cardY + 50;

    for (let i = 0; i < 11; i++) {
      const table = i + 2;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = gridStartX + col * (cellWidth + gap);
      const cellY = gridStartY + row * (cellHeight + gap);

      const bestSpeed = this.progress.getBestSpeed(table);
      const isSelected = table === this.selectedTable;

      // Cell shadow for selected
      if (isSelected) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        this.roundRect(ctx, cellX + 2, cellY + 2, cellWidth, cellHeight, 10);
        ctx.fill();
      }

      // Cell background
      if (isSelected) {
        const gradient = ctx.createLinearGradient(cellX, cellY, cellX, cellY + cellHeight);
        gradient.addColorStop(0, '#66BB6A');
        gradient.addColorStop(1, '#43A047');
        ctx.fillStyle = gradient;
      } else if (bestSpeed > 0) {
        ctx.fillStyle = '#C8E6C9';
      } else {
        ctx.fillStyle = '#F5F5F5';
      }

      this.roundRect(ctx, cellX, cellY, cellWidth, cellHeight, 10);
      ctx.fill();

      // Cell border
      ctx.strokeStyle = isSelected ? '#2E7D32' : '#DDD';
      ctx.lineWidth = isSelected ? 2 : 1;
      this.roundRect(ctx, cellX, cellY, cellWidth, cellHeight, 10);
      ctx.stroke();

      // Table number
      ctx.fillStyle = isSelected ? '#FFF' : '#333';
      ctx.font = 'bold 22px system-ui';
      ctx.fillText(`${table}×`, cellX + cellWidth / 2, cellY + (bestSpeed > 0 ? 25 : 32));

      // Best speed badge
      if (bestSpeed > 0) {
        ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.8)' : '#666';
        ctx.font = '11px system-ui';
        ctx.fillText(`${t('best')}: ${bestSpeed}`, cellX + cellWidth / 2, cellY + 45);
      }
    }

    // Speed selector card
    const speedCardY = 360;
    const speedCardHeight = 80;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.roundRect(ctx, cardX, speedCardY, cardWidth, speedCardHeight, 15);
    ctx.fill();

    // Speed display
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(t('speedLevel'), centerX, speedCardY + 25);

    // Speed arrows and value
    ctx.font = '24px system-ui';
    ctx.fillStyle = '#888';
    ctx.fillText('◀', centerX - 60, speedCardY + 58);
    ctx.fillText('▶', centerX + 60, speedCardY + 58);

    ctx.font = 'bold 32px system-ui';
    ctx.fillStyle = '#4CAF50';
    ctx.fillText(this.selectedSpeed.toString(), centerX, speedCardY + 62);

    ctx.font = '12px system-ui';
    ctx.fillStyle = '#888';
    ctx.fillText('← → or ↑ ↓ to adjust', centerX, speedCardY + 75);

    // Start button
    const btnX = centerX - 110;
    const btnY = 460;
    const btnWidth = 220;
    const btnHeight = 55;

    // Button shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.roundRect(ctx, btnX + 3, btnY + 3, btnWidth, btnHeight, 12);
    ctx.fill();

    // Button gradient
    const btnGradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
    btnGradient.addColorStop(0, '#66BB6A');
    btnGradient.addColorStop(1, '#43A047');
    ctx.fillStyle = btnGradient;
    this.roundRect(ctx, btnX, btnY, btnWidth, btnHeight, 12);
    ctx.fill();

    // Button text
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 26px system-ui';
    ctx.fillText(t('startGame'), centerX, btnY + 36);

    // Instructions
    ctx.fillStyle = '#777';
    ctx.font = '13px system-ui';
    ctx.fillText(t('pressToStart'), centerX, 550);
  }

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
  }

  renderGame() {
    const ctx = this.ctx;
    const DEBUG_HITBOXES = false; // Set to true for debug hitbox rendering

    // Render pipes
    this.pipes.forEach(pipe => pipe.render(ctx));

    // Debug: render pipe hitboxes
    if (DEBUG_HITBOXES) {
      this.pipes.forEach(pipe => pipe.renderDebugHitbox(ctx));
    }

    // Render bird
    this.bird.render(ctx);

    // Debug: render bird hitbox
    if (DEBUG_HITBOXES) {
      ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(this.bird.x, this.bird.y, this.bird.size / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // HUD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, 10, 200, 100);

    ctx.fillStyle = '#FFF';
    ctx.font = '18px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`${t('table')}: ${this.selectedTable}×`, 20, 35);
    ctx.fillText(`${t('speed')}: ${this.selectedSpeed}`, 20, 58);
    ctx.fillText(`${t('streak')}: ${this.scoring.streak}/10`, 20, 81);
    ctx.fillText(`${t('lives')}: ${'❤️'.repeat(this.scoring.lives)}`, 20, 104);

    // Current problem
    if (this.currentProblem) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(CANVAS_WIDTH / 2 - 100, 10, 200, 50);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 28px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(this.currentProblem.text, CANVAS_WIDTH / 2, 45);
    }
  }

  renderGameOver() {
    const ctx = this.ctx;
    const centerX = CANVAS_WIDTH / 2;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign = 'center';

    if (this.showMasteryMessage) {
      // Mastery card
      const cardX = centerX - 200;
      const cardY = 120;
      const cardWidth = 400;
      const cardHeight = 320;

      // Card shadow
      ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
      this.roundRect(ctx, cardX + 5, cardY + 5, cardWidth, cardHeight, 20);
      ctx.fill();

      // Card background with gold gradient
      const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
      cardGradient.addColorStop(0, '#FFF9E6');
      cardGradient.addColorStop(1, '#FFE4A0');
      ctx.fillStyle = cardGradient;
      this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 20);
      ctx.fill();

      // Gold border
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 4;
      this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 20);
      ctx.stroke();

      // Trophy icon (star)
      ctx.fillStyle = '#FFD700';
      ctx.font = '60px system-ui';
      ctx.fillText('⭐', centerX, cardY + 70);

      // Title
      ctx.fillStyle = '#B8860B';
      ctx.font = 'bold 48px system-ui';
      ctx.fillText(t('mastered'), centerX, cardY + 140);

      // Details
      ctx.fillStyle = '#666';
      ctx.font = '24px system-ui';
      ctx.fillText(`${this.selectedTable}× ${t('tableAt')}`, centerX, cardY + 190);
      ctx.fillText(`${t('speedLevelAt')} ${this.selectedSpeed}`, centerX, cardY + 225);

      // Achievement line
      ctx.fillStyle = '#4CAF50';
      ctx.font = 'bold 20px system-ui';
      ctx.fillText(t('correctInRow'), centerX, cardY + 280);

    } else {
      // Game over card
      const cardX = centerX - 180;
      const cardY = 130;
      const cardWidth = 360;
      const cardHeight = 300;

      // Card shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.roundRect(ctx, cardX + 5, cardY + 5, cardWidth, cardHeight, 20);
      ctx.fill();

      // Card background
      const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
      cardGradient.addColorStop(0, '#FFFFFF');
      cardGradient.addColorStop(1, '#F0F0F0');
      ctx.fillStyle = cardGradient;
      this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 20);
      ctx.fill();

      // Title
      ctx.fillStyle = '#E53935';
      ctx.font = 'bold 44px system-ui';
      ctx.fillText(t('gameOver'), centerX, cardY + 60);

      // Divider line
      ctx.strokeStyle = '#DDD';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cardX + 40, cardY + 90);
      ctx.lineTo(cardX + cardWidth - 40, cardY + 90);
      ctx.stroke();

      // Stats
      ctx.fillStyle = '#333';
      ctx.font = '20px system-ui';
      ctx.fillText(t('finalScore'), centerX, cardY + 130);
      ctx.font = 'bold 48px system-ui';
      ctx.fillStyle = '#4CAF50';
      ctx.fillText(this.scoring.score.toString(), centerX, cardY + 180);

      ctx.fillStyle = '#333';
      ctx.font = '20px system-ui';
      ctx.fillText(t('streak'), centerX, cardY + 230);
      ctx.font = 'bold 32px system-ui';
      ctx.fillStyle = '#2196F3';
      ctx.fillText(`${this.scoring.streak} / 10`, centerX, cardY + 270);
    }

    // Continue button
    const btnY = 485;
    const btnHeight = 44;

    // Measure text to fit button width
    ctx.font = '16px system-ui';
    const continueText = t('pressToContinue');
    const textWidth = ctx.measureText(continueText).width;
    const btnWidth = Math.max(200, textWidth + 50);
    const btnX = centerX - btnWidth / 2;

    // Button background with subtle gradient
    const btnGradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
    btnGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    btnGradient.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
    ctx.fillStyle = btnGradient;
    this.roundRect(ctx, btnX, btnY, btnWidth, btnHeight, 22);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, btnX, btnY, btnWidth, btnHeight, 22);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = '16px system-ui';
    ctx.fillText(continueText, centerX, btnY + 28);
  }
}

// Start game when DOM is ready
new Game();
