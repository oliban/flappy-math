import { BASE_WIDTH, BASE_HEIGHT, BASE_SPEED, SPEED_INCREMENT, PIPE_SPAWN_INTERVAL } from './constants.js';
import { createGameState, STATES } from './state.js';
import { createBird } from './bird.js';
import { createPipe } from './pipe.js';
import { generateProblemForTable } from './math.js';
import { checkCollision, CollisionResult } from './collision.js';
import { createScoring } from './scoring.js';
import { createProgress } from './progress.js';
import { createStorage } from './storage.js';
import { createSoundPlayer } from './sound.js';
import { createVoicePlayer } from './voice.js';
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
    this.sound = createSoundPlayer();
    this.voice = createVoicePlayer();
    this.voice.init();
    this.voice.setLanguage(getLanguage());

    this.pipes = [];
    this.currentProblem = null;
    this.selectedTable = 2;
    this.selectedSpeed = 1;
    this.lastPipeSpawn = 0;
    this.showMasteryMessage = false;
    this.fadeOut = 0; // 0 = no fade, increases to 1 over 2 seconds
    this.isFadingOut = false;

    // Detect mobile/touch devices
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.loadProgress();
    this.setupCanvas();
    this.setupInput();

    this.lastTime = 0;
    this.gameLoop = this.gameLoop.bind(this);

    // FPS tracking
    this.frameCount = 0;
    this.fpsLastTime = 0;
    this.currentFPS = 0;

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
    this.updateCanvasSize();
    window.addEventListener('resize', () => this.updateCanvasSize());
  }

  updateCanvasSize() {
    // Internal canvas resolution - height fixed, width based on aspect ratio
    const viewportAspect = window.innerWidth / window.innerHeight;

    this.canvasHeight = BASE_HEIGHT;
    this.canvasWidth = Math.round(BASE_HEIGHT * viewportAspect);

    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;

    // CSS scales canvas to fill viewport
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';

    // Cache sky gradient (recreate on resize)
    this.skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    this.skyGradient.addColorStop(0, '#87CEEB');
    this.skyGradient.addColorStop(1, '#E0F6FF');
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

    // Touch support for mobile
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.handleClick(touch);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  handleClick(e) {
    // Unlock audio/voice on ANY click (must be first!)
    this.sound.unlock();
    this.voice.unlock();

    const rect = this.canvas.getBoundingClientRect();
    // Scale coordinates to match internal canvas dimensions
    const scaleX = this.canvasWidth / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const centerX = this.canvasWidth / 2;

    if (this.state.current() === STATES.MENU) {
      // Voice toggle
      const langY = 30;
      const langStartX = this.canvasWidth - 100;
      const voiceX = langStartX - 45;
      if (x >= voiceX - 18 && x <= voiceX + 18 && y >= langY - 18 && y <= langY + 18) {
        this.voice.toggle();
        return;
      }

      // Language selector
      const langs = getAvailableLanguages();
      for (let i = 0; i < langs.length; i++) {
        const langX = langStartX + i * 45;
        if (x >= langX - 18 && x <= langX + 18 && y >= langY - 18 && y <= langY + 18) {
          setLanguage(langs[i].code);
          this.voice.setLanguage(langs[i].code);
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
      this.sound.play('flap');
      // Speak current question on flap (user gesture context)
      if (this.currentProblem && !this.currentProblem.spoken) {
        this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
        this.currentProblem.spoken = true;
      }
    } else if (this.state.current() === STATES.GAME_OVER) {
      this.state.returnToMenu();
    }
  }

  handleInput() {
    this.sound.unlock();
    const currentState = this.state.current();

    if (currentState === STATES.MENU) {
      this.startGame();
    } else if (currentState === STATES.PLAYING) {
      this.bird.flap();
      this.sound.play('flap');
      // Speak current question on first flap (user gesture context)
      if (this.currentProblem && !this.currentProblem.spoken) {
        this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
        this.currentProblem.spoken = true;
      }
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
    this.fillScreenWithPipes();
  }

  fillScreenWithPipes() {
    // Spawn pipes to fill the screen with consistent spacing
    const PIPE_SPACING = 500;
    const startX = 150 + PIPE_SPACING; // First pipe ahead of bird

    for (let x = startX; x <= this.canvasWidth; x += PIPE_SPACING) {
      this.spawnPipeAt(x);
    }
    this.updateCurrentProblem();
  }

  spawnPipeAt(x) {
    const problem = generateProblemForTable(this.selectedTable);
    const pipe = createPipe(problem.answers, x);
    pipe.problem = problem; // Store problem with pipe
    this.pipes.push(pipe);
  }

  spawnPipe() {
    // Spawn new pipe at right edge
    this.spawnPipeAt(this.canvasWidth);
  }

  updateCurrentProblem() {
    // Show question for first unanswered pipe
    const firstUnanswered = this.pipes.find(p => !p.passed);
    if (firstUnanswered && firstUnanswered.problem) {
      const newProblem = firstUnanswered.problem;
      if (this.currentProblem !== newProblem) {
        this.currentProblem = newProblem;
        // Don't speak here - speak on user interaction (flap/click) instead
      }
    }
  }

  getGameSpeed() {
    return BASE_SPEED + (this.selectedSpeed - 1) * SPEED_INCREMENT;
  }

  gameLoop(timestamp) {
    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Calculate FPS
    this.frameCount++;
    if (timestamp - this.fpsLastTime >= 1000) {
      this.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.fpsLastTime = timestamp;
    }

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
        this.sound.play('crash');
        this.scoring.hitPipe();
        if (this.scoring.isGameOver()) {
          this.startFadeOut();
        }
      }
      this.bird.y = this.bird.size / 2;
    }
    if (this.bird.y >= this.canvasHeight - this.bird.size / 2) {
      if (this.bird.canBeHurt()) {
        this.bird.bounce('up');
        this.sound.play('crash');
        this.scoring.hitPipe();
        if (this.scoring.isGameOver()) {
          this.startFadeOut();
        }
      }
      this.bird.y = this.canvasHeight - this.bird.size / 2;
    }

    const speed = this.getGameSpeed();

    // Update pipes
    this.pipes.forEach(pipe => pipe.update(speed));

    // Remove off-screen pipes (in-place to avoid allocation)
    let pipesRemoved = false;
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      if (this.pipes[i].isOffScreen()) {
        this.pipes.splice(i, 1);
        pipesRemoved = true;
      }
    }
    // Update question if pipes were removed (e.g., crashed into and scrolled past)
    if (pipesRemoved) {
      this.updateCurrentProblem();
    }

    // Spawn new pipe when last pipe has moved far enough from right edge
    const PIPE_SPACING = 500;
    const lastPipe = this.pipes[this.pipes.length - 1];
    if (!lastPipe || lastPipe.x <= this.canvasWidth - PIPE_SPACING) {
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
            this.sound.play('crash');
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
          this.sound.play('thud');
        }
      } else if (result.type === CollisionResult.GAP && !pipe.passed) {
        // Only score gaps on pipes that haven't been passed yet
        pipe.markPassed();
        const isCorrect = result.answer === this.currentProblem.correctAnswer;
        pipe.markGapHit(result.answer, isCorrect);

        // Update to show next question immediately
        this.updateCurrentProblem();

        if (isCorrect) {
          this.scoring.correctAnswer();
          this.sound.play('correct');
          this.voice.speakAnswer(result.answer);

          // Check mastery
          if (this.scoring.hasMastered()) {
            this.progress.updateBestSpeed(this.selectedTable, this.selectedSpeed);
            this.saveProgress();
            this.showMasteryMessage = true;
            this.sound.play('mastery');
            this.startFadeOut();
          }
        } else {
          this.scoring.wrongAnswer();
          this.sound.play('wrong');
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
    if (!this.showMasteryMessage) {
      this.sound.play('gameover');
    }
  }

  render() {
    // Clear canvas with cached sky gradient
    this.ctx.fillStyle = this.skyGradient;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    const currentState = this.state.current();

    if (currentState === STATES.MENU) {
      this.renderMenu();
    } else if (currentState === STATES.PLAYING) {
      this.renderGame();
      // Render fade-out overlay
      if (this.isFadingOut) {
        this.ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeOut * 0.8})`;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      }
    } else if (currentState === STATES.GAME_OVER) {
      this.renderGameOver();
    }

    // FPS counter (top-right, always visible)
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillText(`${this.currentFPS} FPS`, this.canvasWidth - 9, 21);
    this.ctx.fillStyle = 'rgba(100, 255, 100, 0.8)';
    this.ctx.fillText(`${this.currentFPS} FPS`, this.canvasWidth - 10, 20);
  }

  renderMenu() {
    const ctx = this.ctx;
    const centerX = this.canvasWidth / 2;

    // Voice toggle and Language selector (top right)
    const langs = getAvailableLanguages();
    const langY = 30;
    const langStartX = this.canvasWidth - 100;

    // Voice toggle icon (left of language flags)
    const voiceX = langStartX - 45;
    ctx.font = '22px system-ui';
    ctx.textAlign = 'center';
    if (!this.voice.isEnabled()) {
      ctx.globalAlpha = 0.5;
    }
    ctx.fillText(this.voice.isEnabled() ? '🔊' : '🔇', voiceX, langY + 8);
    ctx.globalAlpha = 1;

    // Language flags
    langs.forEach((lang, i) => {
      const x = langStartX + i * 45;
      const isSelected = getLanguage() === lang.code;

      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';

      // Non-selected flags are slightly faded
      if (!isSelected) {
        ctx.globalAlpha = 0.5;
      }

      ctx.fillText(lang.flag, x, langY + 8);
      ctx.globalAlpha = 1;

      // Underline for selected language
      if (isSelected) {
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 12, langY + 16);
        ctx.lineTo(x + 12, langY + 16);
        ctx.stroke();
      }
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
    ctx.fillText(this.selectedSpeed.toString(), centerX, speedCardY + 55);

    // Start button
    const btnY = 455;
    const btnX = centerX - 110;
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

    // Instructions - different for mobile vs desktop
    ctx.fillStyle = '#999';
    ctx.font = '14px system-ui';
    if (this.isMobile) {
      ctx.fillText('Tap to start', centerX, btnY + btnHeight + 25);
    } else {
      ctx.fillText('Press SPACE or click to start  •  Arrow keys to adjust', centerX, btnY + btnHeight + 25);
    }
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

    // HUD - Stats panel (bottom-right, semi-transparent)
    const hudWidth = 160;
    const hudHeight = 115;
    const hudX = this.canvasWidth - hudWidth - 12;
    const hudY = this.canvasHeight - hudHeight - 12;
    const hudRadius = 12;

    // HUD shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.roundRect(ctx, hudX + 3, hudY + 3, hudWidth, hudHeight, hudRadius);
    ctx.fill();

    // HUD background with gradient (semi-transparent)
    const hudGradient = ctx.createLinearGradient(hudX, hudY, hudX, hudY + hudHeight);
    hudGradient.addColorStop(0, 'rgba(30, 40, 50, 0.7)');
    hudGradient.addColorStop(1, 'rgba(20, 25, 35, 0.75)');
    ctx.fillStyle = hudGradient;
    this.roundRect(ctx, hudX, hudY, hudWidth, hudHeight, hudRadius);
    ctx.fill();

    // HUD border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, hudX, hudY, hudWidth, hudHeight, hudRadius);
    ctx.stroke();

    // Stats text
    ctx.textAlign = 'left';
    ctx.font = '15px system-ui';

    // Table
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(t('table'), hudX + 12, hudY + 24);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 15px system-ui';
    ctx.fillText(`${this.selectedTable}×`, hudX + hudWidth - 45, hudY + 24);

    // Speed
    ctx.font = '15px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(t('speed'), hudX + 12, hudY + 46);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 15px system-ui';
    ctx.fillText(`${this.selectedSpeed}`, hudX + hudWidth - 45, hudY + 46);

    // Streak with progress indicator
    ctx.font = '15px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(t('streak'), hudX + 12, hudY + 68);
    ctx.fillStyle = this.scoring.streak >= 7 ? '#4CAF50' : '#FFF';
    ctx.font = 'bold 15px system-ui';
    ctx.fillText(`${this.scoring.streak}/10`, hudX + hudWidth - 45, hudY + 68);

    // Lives as hearts
    ctx.font = '15px system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(t('lives'), hudX + 12, hudY + 92);
    ctx.font = '18px system-ui';
    const hearts = '❤️'.repeat(Math.max(0, this.scoring.lives));
    const emptyHearts = '🖤'.repeat(Math.max(0, 3 - this.scoring.lives));
    ctx.fillText(hearts + emptyHearts, hudX + 55, hudY + 93);

    // Current problem - centered pill shape
    if (this.currentProblem) {
      const problemWidth = 180;
      const problemHeight = 50;
      const problemX = this.canvasWidth / 2 - problemWidth / 2;
      const problemY = 12;

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.roundRect(ctx, problemX + 3, problemY + 3, problemWidth, problemHeight, 25);
      ctx.fill();

      // Background
      const problemGradient = ctx.createLinearGradient(problemX, problemY, problemX, problemY + problemHeight);
      problemGradient.addColorStop(0, 'rgba(30, 40, 50, 0.95)');
      problemGradient.addColorStop(1, 'rgba(20, 25, 35, 0.98)');
      ctx.fillStyle = problemGradient;
      this.roundRect(ctx, problemX, problemY, problemWidth, problemHeight, 25);
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 2;
      this.roundRect(ctx, problemX, problemY, problemWidth, problemHeight, 25);
      ctx.stroke();

      // Problem text
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 26px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(this.currentProblem.text, this.canvasWidth / 2, problemY + 34);
    }
  }

  renderGameOver() {
    const ctx = this.ctx;
    const centerX = this.canvasWidth / 2;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

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
      ctx.fillText(`${this.scoring.bestStreak} / 10`, centerX, cardY + 270);
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
