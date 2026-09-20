import {
  BASE_WIDTH, BASE_HEIGHT, BASE_SPEED, SPEED_INCREMENT, PIPE_SPAWN_INTERVAL,
  MIN_SPEED, MAX_SPEED, MIN_TABLE, MAX_TABLE
} from './constants.js';

const TABLE_COUNT = MAX_TABLE - MIN_TABLE + 1;
import { createGameState, STATES } from './state.js';
import { createBird } from './bird.js';
import { createPipe } from './pipe.js';
import { generateProblemForTable } from './math.js';
import { checkCollision, CollisionResult } from './collision.js';
import { createScoring } from './scoring.js';
import { createProgress } from './progress.js';
import { createStorage, HIGHSCORES_KEY, SKINS_KEY } from './storage.js';
import { createHighscores } from './highscores.js';
import { createSkins, SKINS } from './skins.js';
import { createGlobalScores } from './globalScores.js';
import { createPlayer } from './player.js';
import { drawBirdShape } from './bird.js';
import { createConfetti } from './confetti.js';
import { getDailyTable, getDayKey, formatTimeUntilNextTable } from './dailyTable.js';
import { createWeatherClient, createLocationStore, describeWeather } from './weather.js';
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

    // Highscores: a local list to beat your own runs, a global one to compare
    // with friends. Rewards (bird skins) come from the local list only.
    this.highscores = createHighscores();
    this.highscoreStorage = createStorage(window.localStorage, HIGHSCORES_KEY);
    this.skins = createSkins();
    this.skinStorage = createStorage(window.localStorage, SKINS_KEY);
    this.player = createPlayer();
    this.globalScores = createGlobalScores();
    this.confetti = createConfetti();

    // Weather comes from our own server; the browser is never asked where it is.
    this.weatherClient = createWeatherClient();
    this.locationStore = createLocationStore();
    this.weather = { status: 'loading', reading: null };
    this.weatherRequestId = 0;
    this.sound = createSoundPlayer();
    this.voice = createVoicePlayer();
    this.voice.init();
    this.voice.setLanguage(getLanguage());

    this.pipes = [];
    this.currentProblem = null;

    // The table of the day is what the game plays; practice mode is where any
    // table can be picked.
    this.dayKey = getDayKey();
    this.dailyTable = getDailyTable();
    this.menuView = 'daily'; // 'daily' | 'practice'
    this.practiceTable = 3;
    this.selectedTable = this.dailyTable;
    this.selectedSpeed = 1;
    this.lastDayCheck = 0;
    this.lastPipeSpawn = 0;
    this.showMasteryMessage = false;
    this.fadeOut = 0; // 0 = no fade, increases to 1 over 2 seconds
    this.isFadingOut = false;

    // Highscore screen state
    this.highscoreTab = 'local'; // 'local' | 'global'
    this.highscoreTable = null;  // null = all tables, otherwise 1-12
    this.globalList = { status: 'idle', entries: [], error: null };
    this.globalRequestId = 0;

    // Result of the run that just ended
    this.lastResult = null;       // { rank, isPersonalBest, previousBest, score }
    this.unlockedSkin = null;     // skin unlocked by beating a personal best
    this.globalSubmission = null; // { status, rank }

    // Detect mobile/touch devices
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.loadProgress();
    this.setupCanvas();
    this.setupInput();
    this.setupNameDialog();
    this.setupLocationDialog();
    this.refreshWeather();

    this.lastTime = 0;
    this.gameLoop = this.gameLoop.bind(this);

    // FPS tracking
    this.frameCount = 0;
    this.fpsLastTime = 0;
    this.currentFPS = 0;

    // Preload audio for all tables (runs in background)
    this.preloadAllVoiceAudio();

    requestAnimationFrame(this.gameLoop);
  }

  loadProgress() {
    const saved = this.storage.load();
    if (saved) {
      this.progress.import(saved);
    }

    const savedHighscores = this.highscoreStorage.load();
    if (savedHighscores) {
      this.highscores.import(savedHighscores);
    }

    const savedSkins = this.skinStorage.load();
    if (savedSkins) {
      this.skins.import(savedSkins);
    }

    this.player.load();
    this.bird.setColors(this.skins.getSelected().colors);
  }

  saveProgress() {
    this.storage.save(this.progress.export());
  }

  saveHighscores() {
    this.highscoreStorage.save(this.highscores.export());
  }

  saveSkins() {
    this.skinStorage.save(this.skins.export());
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

    // CSS scales canvas to fill viewport (use px for mobile Safari compatibility)
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;

    // Cache sky gradient (recreate on resize)
    this.skyGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
    this.skyGradient.addColorStop(0, '#87CEEB');
    this.skyGradient.addColorStop(1, '#E0F6FF');
  }

  // Single source of truth for menu geometry, shared by rendering and hit testing.
  getMenuLayout() {
    const centerX = this.canvasWidth / 2;
    const compact = this.isMobile ? 0.85 : 1;
    const baseY = this.isMobile ? 30 : 80;

    const cardWidth = 500;
    const cardX = centerX - cardWidth / 2;
    const cardY = baseY + 50;
    const cardHeight = Math.round(200 * compact);

    const cols = 6;
    const cellWidth = Math.round(65 * compact);
    const cellHeight = Math.round(55 * compact);
    const gap = Math.round(8 * compact);
    const gridWidth = cols * cellWidth + (cols - 1) * gap;
    const gridStartX = centerX - gridWidth / 2;
    const gridStartY = cardY + Math.round(45 * compact);

    const speedCardY = cardY + cardHeight + Math.round(15 * compact);
    const speedCardHeight = Math.round(70 * compact);

    const btnY = speedCardY + speedCardHeight + Math.round(12 * compact);
    const btnHeight = Math.round(50 * compact);
    const btnWidth = 220;
    const startBtnX = centerX - btnWidth - 10;
    const highscoreBtnX = centerX + 10;

    const skinSize = Math.round(34 * compact);
    const skinGap = Math.round(6 * compact);
    const skinRowWidth = SKINS.length * skinSize + (SKINS.length - 1) * skinGap;
    const skinStartX = centerX - skinRowWidth / 2;
    const skinY = btnY + btnHeight + Math.round(20 * compact);

    return {
      centerX, compact, baseY,
      cardX, cardY, cardWidth, cardHeight,
      cols, cellWidth, cellHeight, gap, gridStartX, gridStartY,
      speedCardY, speedCardHeight,
      btnY, btnWidth, btnHeight, startBtnX, highscoreBtnX,
      skinSize, skinGap, skinStartX, skinY
    };
  }

  // Geometry of the daily view of the menu (today's table + start buttons).
  getDailyLayout() {
    const centerX = this.canvasWidth / 2;
    const compact = this.isMobile ? 0.85 : 1;
    const baseY = this.isMobile ? 30 : 80;

    const cardWidth = 500;
    const cardX = centerX - cardWidth / 2;
    const cardY = baseY + 50;
    const cardHeight = Math.round(155 * compact);

    const speedCardY = cardY + cardHeight + Math.round(15 * compact);
    const speedCardHeight = Math.round(70 * compact);

    const btnY = speedCardY + speedCardHeight + Math.round(12 * compact);
    const btnHeight = Math.round(50 * compact);
    const btnWidth = 220;
    const startBtnX = centerX - btnWidth - 10;
    const highscoreBtnX = centerX + 10;

    const practiceBtnWidth = Math.round(200 * compact);
    const practiceBtnHeight = Math.round(36 * compact);
    const practiceBtnX = centerX - practiceBtnWidth / 2;
    const practiceBtnY = btnY + btnHeight + Math.round(12 * compact);

    const skinSize = Math.round(34 * compact);
    const skinGap = Math.round(6 * compact);
    const skinRowWidth = SKINS.length * skinSize + (SKINS.length - 1) * skinGap;
    const skinStartX = centerX - skinRowWidth / 2;
    const skinY = practiceBtnY + practiceBtnHeight + Math.round(24 * compact);

    return {
      centerX, compact, baseY,
      cardX, cardY, cardWidth, cardHeight,
      speedCardY, speedCardHeight,
      btnY, btnWidth, btnHeight, startBtnX, highscoreBtnX,
      practiceBtnX, practiceBtnY, practiceBtnWidth, practiceBtnHeight,
      skinSize, skinGap, skinStartX, skinY
    };
  }

  // Geometry of the highscore screen, shared by rendering and hit testing.
  getHighscoreLayout() {
    const centerX = this.canvasWidth / 2;
    const compact = this.isMobile ? 0.85 : 1;

    const panelWidth = Math.min(560, this.canvasWidth - 40);
    const panelX = centerX - panelWidth / 2;
    const panelY = this.isMobile ? 16 : 36;
    const panelHeight = this.canvasHeight - panelY * 2;

    const tabHeight = Math.round(34 * compact);
    const tabY = panelY + Math.round(54 * compact);
    const tabWidth = Math.round(panelWidth / 2) - 26;
    const localTabX = panelX + 20;
    const globalTabX = panelX + Math.round(panelWidth / 2) + 6;

    const filterY = tabY + tabHeight + Math.round(10 * compact);
    const filterHeight = Math.round(28 * compact);
    const filterWidth = Math.round(150 * compact);
    const filterX = centerX - filterWidth / 2;
    const filterArrowWidth = Math.round(34 * compact);
    const prevTableX = filterX - filterArrowWidth - Math.round(6 * compact);
    const nextTableX = filterX + filterWidth + Math.round(6 * compact);

    const footerHeight = Math.round(42 * compact);
    const footerY = panelY + panelHeight - footerHeight - 14;
    const backBtnWidth = Math.round(140 * compact);
    const backBtnX = panelX + panelWidth - backBtnWidth - 20;
    const nameBtnWidth = Math.round(150 * compact);
    const nameBtnX = panelX + 20;

    const rowsY = filterY + filterHeight + Math.round(14 * compact);
    const rowHeight = Math.round(30 * compact);
    const maxRows = Math.max(1, Math.min(10, Math.floor((footerY - 12 - rowsY) / rowHeight)));

    return {
      centerX, compact,
      panelX, panelY, panelWidth, panelHeight,
      tabY, tabHeight, tabWidth, localTabX, globalTabX,
      filterX, filterY, filterWidth, filterHeight,
      filterArrowWidth, prevTableX, nextTableX,
      rowsY, rowHeight, maxRows,
      footerY, footerHeight, backBtnX, backBtnWidth, nameBtnX, nameBtnWidth
    };
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      // An open dialog owns the keyboard.
      if (this.isNameDialogOpen() || this.isLocationDialogOpen()) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.handleInput();
      }
      // Escape leaves practice mode, or any screen, back to the daily menu
      if (e.code === 'Escape') {
        if (this.state.current() !== STATES.MENU) {
          this.state.returnToMenu();
        } else if (this.menuView === 'practice') {
          this.showDailyMenu();
        }
      }

      // H opens the highscore lists from the menu or the game over screen
      if (e.key === 'h' || e.key === 'H') {
        if (this.state.current() === STATES.MENU || this.state.current() === STATES.GAME_OVER) {
          this.openHighscores();
        } else if (this.state.current() === STATES.HIGHSCORES) {
          this.state.returnToMenu();
        }
      }

      // Table selection only exists in practice mode
      if (this.state.current() === STATES.MENU && this.menuView === 'practice') {
        const num = parseInt(e.key);
        if (num >= MIN_TABLE && num <= 9) {
          this.selectedTable = num;
        }
        if (e.key === '0') this.selectedTable = 10;
        if (e.key === '-') this.selectedTable = 11;
        if (e.key === '=') this.selectedTable = 12;

        // Arrow keys for table and speed
        if (e.code === 'ArrowLeft') {
          this.selectedTable = Math.max(this.selectedTable - 1, MIN_TABLE);
        }
        if (e.code === 'ArrowRight') {
          this.selectedTable = Math.min(this.selectedTable + 1, MAX_TABLE);
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
    // Unlock audio on click (voice doesn't need unlock - speak happens in user gesture)
    this.sound.unlock();

    const rect = this.canvas.getBoundingClientRect();
    // Scale coordinates to match internal canvas dimensions
    const scaleX = this.canvasWidth / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const centerX = this.canvasWidth / 2;

    if (this.state.current() === STATES.MENU) {
      // Weather text opens the location picker
      if (this.hitsRect(x, y, this.getWeatherRect())) {
        this.openLocationDialog();
        return;
      }

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

      if (this.menuView === 'daily') {
        this.handleDailyMenuClick(x, y, centerX);
        return;
      }

      const layout = this.getMenuLayout();
      const { compact, cols, cellWidth, cellHeight, gap, gridStartX, gridStartY } = layout;

      for (let i = 0; i < TABLE_COUNT; i++) {
        const table = i + MIN_TABLE;
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
      const { speedCardY } = layout;
      if (y >= speedCardY + Math.round(35 * compact) && y <= speedCardY + Math.round(65 * compact)) {
        if (x >= centerX - 80 && x <= centerX - 40) {
          this.selectedSpeed = Math.max(this.selectedSpeed - 1, MIN_SPEED);
          return;
        }
        if (x >= centerX + 40 && x <= centerX + 80) {
          this.selectedSpeed = Math.min(this.selectedSpeed + 1, MAX_SPEED);
          return;
        }
      }

      // Start / back buttons
      const { btnY, btnWidth, btnHeight, startBtnX, highscoreBtnX } = layout;
      if (y >= btnY && y <= btnY + btnHeight) {
        if (x >= startBtnX && x <= startBtnX + btnWidth) {
          this.practiceTable = this.selectedTable;
          this.startGame();
          return;
        }
        if (x >= highscoreBtnX && x <= highscoreBtnX + btnWidth) {
          this.showDailyMenu();
          return;
        }
      }
    } else if (this.state.current() === STATES.HIGHSCORES) {
      this.handleHighscoreClick(x, y);
    } else if (this.state.current() === STATES.PLAYING) {
      this.bird.flap();
      this.sound.play('flap');
      // Speak current question on flap (user gesture context)
      if (this.currentProblem && !this.currentProblem.spoken) {
        this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
        this.currentProblem.spoken = true;
      }
    } else if (this.state.current() === STATES.GAME_OVER) {
      const buttons = this.getGameOverButtons();

      if (this.hitsRect(x, y, buttons.playAgain)) {
        this.playAgain();
        return;
      }
      if (this.hitsRect(x, y, buttons.highscores)) {
        this.openHighscores();
        return;
      }
      if (buttons.name && this.hitsRect(x, y, buttons.name)) {
        this.openNameDialog();
        return;
      }

      this.state.returnToMenu();
    }
  }

  handleDailyMenuClick(x, y, centerX) {
    const layout = this.getDailyLayout();
    const { compact } = layout;

    // Speed arrows
    if (y >= layout.speedCardY + Math.round(35 * compact) &&
        y <= layout.speedCardY + Math.round(65 * compact)) {
      if (x >= centerX - 80 && x <= centerX - 40) {
        this.selectedSpeed = Math.max(this.selectedSpeed - 1, MIN_SPEED);
        return;
      }
      if (x >= centerX + 40 && x <= centerX + 80) {
        this.selectedSpeed = Math.min(this.selectedSpeed + 1, MAX_SPEED);
        return;
      }
    }

    if (y >= layout.btnY && y <= layout.btnY + layout.btnHeight) {
      if (x >= layout.startBtnX && x <= layout.startBtnX + layout.btnWidth) {
        this.startGame();
        return;
      }
      if (x >= layout.highscoreBtnX && x <= layout.highscoreBtnX + layout.btnWidth) {
        this.openHighscores();
        return;
      }
    }

    if (y >= layout.practiceBtnY && y <= layout.practiceBtnY + layout.practiceBtnHeight &&
        x >= layout.practiceBtnX && x <= layout.practiceBtnX + layout.practiceBtnWidth) {
      this.showPracticeMenu();
      return;
    }

    // Bird skin picker
    const { skinSize, skinGap, skinStartX, skinY } = layout;
    if (y >= skinY && y <= skinY + skinSize) {
      for (let i = 0; i < SKINS.length; i++) {
        const skinX = skinStartX + i * (skinSize + skinGap);
        if (x >= skinX && x <= skinX + skinSize) {
          this.selectSkin(SKINS[i].id);
          return;
        }
      }
    }
  }

  hitsRect(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
  }

  handleInput() {
    this.sound.unlock();
    const currentState = this.state.current();

    if (currentState === STATES.MENU) {
      if (this.menuView === 'practice') this.practiceTable = this.selectedTable;
      this.startGame();
    } else if (currentState === STATES.HIGHSCORES) {
      this.state.returnToMenu();
    } else if (currentState === STATES.PLAYING) {
      this.bird.flap();
      this.sound.play('flap');
      // Speak current question on first flap (user gesture context)
      if (this.currentProblem && !this.currentProblem.spoken) {
        this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
        this.currentProblem.spoken = true;
      }
    } else if (currentState === STATES.GAME_OVER) {
      this.playAgain();
    }
  }

  // Straight back into another run on the same table and speed.
  playAgain() {
    this.state.returnToMenu();
    this.startGame();
  }

  startGame() {
    this.state.startGame();
    this.confetti.clear();
    this.bird.reset();
    this.scoring.reset();
    this.pipes = [];
    this.showMasteryMessage = false;
    this.lastPipeSpawn = 0;
    this.fadeOut = 0;
    this.isFadingOut = false;
    this.fillScreenWithPipes();

    // Speak first question immediately (user clicked Start, so we have gesture context)
    if (this.currentProblem) {
      this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
      this.currentProblem.spoken = true;
    }
  }

  preloadAllVoiceAudio() {
    // Collect all numbers needed for all tables (1-12 * 1-12)
    const numbers = new Set();
    for (let a = 1; a <= 12; a++) {
      for (let b = 1; b <= 12; b++) {
        numbers.add(a);
        numbers.add(b);
        numbers.add(a * b);
      }
    }
    this.voice.preload([...numbers]);
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

    // Normalize delta time: 1.0 at 60fps, 0.5 at 120fps
    const dt = deltaTime / 16.667;

    // Calculate FPS
    this.frameCount++;
    if (timestamp - this.fpsLastTime >= 1000) {
      this.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.fpsLastTime = timestamp;
    }

    if (timestamp - this.lastDayCheck > 1000) {
      this.lastDayCheck = timestamp;
      this.refreshDailyTable();
    }

    this.update(deltaTime, dt, timestamp);
    this.confetti.update(Math.min(dt, 3)); // clamp after a tab switch
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

          if (this.selectedSpeed <= 7) {
            // Lower speeds: play sound, speak answer, then question after delay
            this.sound.play('correct');
            this.voice.speakAnswer(result.answer);
            if (this.currentProblem) {
              const problem = this.currentProblem;
              problem.spoken = true; // Mark as spoken immediately to prevent double-speak
              setTimeout(() => {
                this.voice.speakQuestion(problem.a, problem.b);
              }, 1000);
            }
          } else {
            // Higher speeds: speak question FIRST (immediately), then sound
            if (this.currentProblem) {
              this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
              this.currentProblem.spoken = true;
            }
            this.sound.play('correct');
          }

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

          if (this.selectedSpeed <= 7) {
            // Lower speeds: play sound, then question after delay
            this.sound.play('wrong');
            if (this.currentProblem && !this.scoring.isGameOver()) {
              const problem = this.currentProblem;
              problem.spoken = true;
              setTimeout(() => {
                this.voice.speakQuestion(problem.a, problem.b);
              }, 1000);
            }
          } else {
            // Higher speeds: speak question FIRST, then sound
            if (this.currentProblem && !this.scoring.isGameOver()) {
              this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
              this.currentProblem.spoken = true;
            }
            this.sound.play('wrong');
          }

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

    this.recordRun();

    if (this.lastResult && this.lastResult.isPersonalBest) {
      this.celebrateRecord();
    } else if (this.showMasteryMessage) {
      // The mastery sound already played when the streak was completed.
    } else {
      this.sound.play('gameover');
    }
  }

  // Fanfare and confetti cannons for beating your own local highscore.
  celebrateRecord() {
    this.sound.play('fanfare');

    const floor = this.canvasHeight + 10;
    const cannonSpeed = this.canvasHeight / 42;

    // Two cannons firing inwards from the bottom corners...
    this.confetti.burst({
      x: 40, y: floor, count: 70,
      angle: -Math.PI / 2.6, spread: Math.PI / 5, speed: cannonSpeed
    });
    this.confetti.burst({
      x: this.canvasWidth - 40, y: floor, count: 70,
      angle: -Math.PI + Math.PI / 2.6, spread: Math.PI / 5, speed: cannonSpeed
    });

    // ...and a shower over the card itself.
    this.confetti.burst({
      x: this.canvasWidth / 2, y: 120, count: 50,
      angle: -Math.PI / 2, spread: Math.PI * 1.6, speed: cannonSpeed * 0.55
    });
  }

  // Stores the finished run locally, hands out the reward for a new personal
  // best, and offers the run to the global list.
  recordRun() {
    const run = {
      score: this.scoring.score,
      table: this.selectedTable,
      speed: this.selectedSpeed,
      streak: this.scoring.bestStreak,
      name: this.player.getName()
    };

    this.lastResult = { ...this.highscores.add(run), score: run.score };
    this.saveHighscores();

    this.unlockedSkin = null;
    if (this.lastResult.isPersonalBest) {
      const unlocked = this.skins.unlockNext();
      if (unlocked) {
        this.skins.select(unlocked.id);
        this.bird.setColors(this.skins.getSelected().colors);
        this.saveSkins();
        this.unlockedSkin = unlocked;
      }
    }

    this.submitToGlobal(run);
  }

  submitToGlobal(run) {
    this.globalSubmission = null;
    this.pendingSubmission = null;

    if (run.score <= 0 || !this.globalScores.isAvailable()) return;

    if (!this.player.hasName()) {
      // Remember the run so it can still be sent if a name is entered now.
      this.pendingSubmission = run;
      this.globalSubmission = { status: 'no-name' };
      return;
    }

    this.globalSubmission = { status: 'pending' };
    this.globalScores.submit({ ...run, name: this.player.getName() }).then(result => {
      this.globalSubmission = result.ok
        ? { status: 'ok', rank: result.rank }
        : { status: 'error', error: result.error };
    });
  }

  // Rolls the table over at local midnight without needing a reload.
  refreshDailyTable() {
    const key = getDayKey();
    if (key === this.dayKey) return;

    this.dayKey = key;
    this.dailyTable = getDailyTable();

    if (this.menuView === 'daily') {
      this.selectedTable = this.dailyTable;
    }
  }

  showPracticeMenu() {
    this.menuView = 'practice';
    this.selectedTable = this.practiceTable;
  }

  showDailyMenu() {
    // Remember the practice choice, but the daily view always plays today's table.
    if (this.menuView === 'practice') {
      this.practiceTable = this.selectedTable;
    }
    this.menuView = 'daily';
    this.selectedTable = this.dailyTable;
  }

  openHighscores() {
    this.state.showHighscores();
    // Open on the table that was just played, which is today's table by default.
    this.highscoreTable = this.selectedTable;
    if (this.highscoreTab === 'global') this.refreshGlobal();
  }

  // Cycles through: all tables, 1x, 2x ... 12x.
  stepHighscoreTable(direction) {
    const options = [null];
    for (let table = MIN_TABLE; table <= MAX_TABLE; table++) options.push(table);

    const current = options.indexOf(this.highscoreTable);
    const next = (current + direction + options.length) % options.length;

    this.highscoreTable = options[next];
    if (this.highscoreTab === 'global') this.refreshGlobal();
  }

  setHighscoreTab(tab) {
    if (this.highscoreTab === tab) return;

    this.highscoreTab = tab;
    if (tab === 'global') this.refreshGlobal();
  }

  refreshGlobal() {
    if (!this.globalScores.isAvailable()) {
      this.globalList = { status: 'error', entries: [], error: 'unavailable' };
      return;
    }

    const requestId = ++this.globalRequestId;
    this.globalList = { status: 'loading', entries: [], error: null };

    this.globalScores.fetchTop({ table: this.highscoreTable, limit: 10 }).then(result => {
      // Ignore a response that a newer request has already superseded.
      if (requestId !== this.globalRequestId) return;

      this.globalList = result.ok
        ? { status: 'ok', entries: result.entries, error: null }
        : { status: 'error', entries: [], error: result.error };
    });
  }

  handleHighscoreClick(x, y) {
    const layout = this.getHighscoreLayout();

    if (y >= layout.tabY && y <= layout.tabY + layout.tabHeight) {
      if (x >= layout.localTabX && x <= layout.localTabX + layout.tabWidth) {
        this.setHighscoreTab('local');
        return;
      }
      if (x >= layout.globalTabX && x <= layout.globalTabX + layout.tabWidth) {
        this.setHighscoreTab('global');
        return;
      }
    }

    if (y >= layout.filterY && y <= layout.filterY + layout.filterHeight) {
      if (x >= layout.prevTableX && x <= layout.prevTableX + layout.filterArrowWidth) {
        this.stepHighscoreTable(-1);
        return;
      }
      if (x >= layout.nextTableX && x <= layout.nextTableX + layout.filterArrowWidth) {
        this.stepHighscoreTable(1);
        return;
      }
      // Tapping the label itself jumps back to today's table.
      if (x >= layout.filterX && x <= layout.filterX + layout.filterWidth) {
        this.highscoreTable = this.dailyTable;
        if (this.highscoreTab === 'global') this.refreshGlobal();
        return;
      }
    }

    if (y >= layout.footerY && y <= layout.footerY + layout.footerHeight) {
      if (x >= layout.backBtnX && x <= layout.backBtnX + layout.backBtnWidth) {
        this.state.returnToMenu();
        return;
      }
      if (x >= layout.nameBtnX && x <= layout.nameBtnX + layout.nameBtnWidth) {
        this.openNameDialog();
      }
    }
  }

  selectSkin(id) {
    if (!this.skins.select(id)) return;

    this.bird.setColors(this.skins.getSelected().colors);
    this.saveSkins();
    this.sound.play('flap');
  }

  getGameOverButtons() {
    const centerX = this.canvasWidth / 2;
    const y = 500;
    const height = 42;
    const gap = 10;
    const needsName = Boolean(this.globalSubmission && this.globalSubmission.status === 'no-name');

    const widths = needsName ? [140, 200, 120, 160] : [200, 120, 160];
    const total = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);

    let x = centerX - total / 2;
    const buttons = {};

    if (needsName) {
      buttons.name = { x, y, width: 140, height };
      x += 140 + gap;
    }
    buttons.playAgain = { x, y, width: 200, height };
    x += 200 + gap;
    buttons.menu = { x, y, width: 120, height };
    x += 120 + gap;
    buttons.highscores = { x, y, width: 160, height };

    return buttons;
  }

  refreshWeather() {
    const requestId = ++this.weatherRequestId;
    this.weather = { status: 'loading', reading: this.weather ? this.weather.reading : null };

    this.weatherClient.fetchWeather(this.locationStore.load()).then(result => {
      if (requestId !== this.weatherRequestId) return; // a newer request won

      this.weather = result.ok
        ? { status: 'ok', reading: result.weather }
        : { status: 'error', reading: null };
    });
  }

  // Bounding box of the weather text on the menu, for hit testing.
  getWeatherRect() {
    const height = 26;

    return {
      x: 12,
      y: 16,
      width: Math.min(230, this.canvasWidth * 0.4),
      height
    };
  }

  weatherLabel() {
    if (this.weather.status === 'loading' && !this.weather.reading) return '⛅ …';
    if (this.weather.status === 'error') return `🌡️ ${t('weatherUnavailable')}`;

    const reading = this.weather.reading;
    if (!reading) return `🌡️ ${t('weatherUnknown')}`;

    const { icon } = describeWeather(reading.code, reading.isDay);
    const place = reading.location.name || '';
    return `${icon} ${place} ${Math.round(reading.temperature)}°`;
  }

  setupLocationDialog() {
    this.locationDialog = document.getElementById('location-dialog');
    if (!this.locationDialog) return;

    this.locationInput = document.getElementById('location-input');
    this.locationResults = document.getElementById('location-results');
    this.locationStatus = document.getElementById('location-status');

    document.getElementById('location-search').addEventListener('click', () => this.searchLocation());
    document.getElementById('location-close').addEventListener('click', () => this.closeLocationDialog());
    document.getElementById('location-mine').addEventListener('click', () => this.useDeviceLocation());
    document.getElementById('location-default').addEventListener('click', () => {
      this.locationStore.clear();
      this.refreshWeather();
      this.closeLocationDialog();
    });

    this.locationInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.searchLocation();
      if (e.key === 'Escape') this.closeLocationDialog();
    });
  }

  isLocationDialogOpen() {
    return Boolean(this.locationDialog) && !this.locationDialog.classList.contains('hidden');
  }

  openLocationDialog() {
    if (!this.locationDialog) return;

    document.getElementById('location-dialog-title').textContent = t('locationTitle');
    document.getElementById('location-dialog-hint').textContent = t('locationHint');
    document.getElementById('location-search').textContent = t('locationSearch');
    document.getElementById('location-mine').textContent = t('locationUseMine');
    document.getElementById('location-default').textContent = t('locationUseDefault');
    document.getElementById('location-close').textContent = t('close');
    this.locationInput.placeholder = t('locationPlaceholder');

    this.locationStatus.textContent = '';
    this.locationResults.innerHTML = '';
    this.locationInput.value = '';
    this.locationDialog.classList.remove('hidden');
    this.locationInput.focus();
  }

  closeLocationDialog() {
    if (this.locationDialog) this.locationDialog.classList.add('hidden');
  }

  async searchLocation() {
    const query = this.locationInput.value;
    if (!query.trim()) return;

    this.locationStatus.textContent = t('locationSearching');
    this.locationResults.innerHTML = '';

    const result = await this.weatherClient.searchPlaces(query);

    if (!result.ok) {
      this.locationStatus.textContent = t('locationFailed');
      return;
    }
    if (result.places.length === 0) {
      this.locationStatus.textContent = t('locationNoResults');
      return;
    }

    this.locationStatus.textContent = '';
    result.places.forEach(place => this.addLocationResult(place));
  }

  addLocationResult(place) {
    const detail = [place.region, place.country].filter(Boolean).join(', ');
    const item = document.createElement('li');
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = place.name;

    if (detail) {
      const span = document.createElement('span');
      span.className = 'place-detail';
      span.textContent = `  ${detail}`;
      button.appendChild(span);
    }

    button.addEventListener('click', () => this.chooseLocation(place));
    item.appendChild(button);
    this.locationResults.appendChild(item);
  }

  chooseLocation(place) {
    if (!this.locationStore.save(place)) return;

    this.refreshWeather();
    this.closeLocationDialog();
  }

  // Only ever runs because the player asked for it by pressing the button.
  useDeviceLocation() {
    if (!navigator.geolocation) {
      this.locationStatus.textContent = t('locationFailed');
      return;
    }

    this.locationStatus.textContent = t('locationSearching');

    navigator.geolocation.getCurrentPosition(
      position => {
        this.chooseLocation({
          name: '',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      () => {
        this.locationStatus.textContent = t('locationDenied');
      },
      { timeout: 8000 }
    );
  }

  setupNameDialog() {
    this.nameDialog = document.getElementById('name-dialog');
    this.nameInput = document.getElementById('name-input');
    this.nameSaveBtn = document.getElementById('name-save');
    this.nameCancelBtn = document.getElementById('name-cancel');
    this.pendingSubmission = null;

    if (!this.nameDialog) return;

    this.nameSaveBtn.addEventListener('click', () => this.saveNameFromDialog());
    this.nameCancelBtn.addEventListener('click', () => this.closeNameDialog());
    this.nameInput.addEventListener('keydown', (e) => {
      // Keep typing out of the game controls.
      e.stopPropagation();
      if (e.key === 'Enter') this.saveNameFromDialog();
      if (e.key === 'Escape') this.closeNameDialog();
    });
  }

  isNameDialogOpen() {
    return Boolean(this.nameDialog) && !this.nameDialog.classList.contains('hidden');
  }

  openNameDialog() {
    if (!this.nameDialog) return;

    document.getElementById('name-dialog-title').textContent = t('nameTitle');
    document.getElementById('name-dialog-hint').textContent = t('nameHint');
    this.nameSaveBtn.textContent = t('save');
    this.nameCancelBtn.textContent = t('cancel');

    this.nameInput.value = this.player.getName();
    this.nameDialog.classList.remove('hidden');
    this.nameInput.focus();
    this.nameInput.select();
  }

  closeNameDialog() {
    if (this.nameDialog) this.nameDialog.classList.add('hidden');
  }

  saveNameFromDialog() {
    // An empty name is rejected; leave the dialog open so it can be corrected.
    if (!this.player.setName(this.nameInput.value)) return;

    this.closeNameDialog();

    // A run that finished before a name existed can now join the global list.
    if (this.pendingSubmission) {
      this.submitToGlobal(this.pendingSubmission);
    }

    if (this.state.current() === STATES.HIGHSCORES && this.highscoreTab === 'global') {
      this.refreshGlobal();
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
    } else if (currentState === STATES.HIGHSCORES) {
      this.renderHighscores();
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

    // Weather (top left) - click it to change location
    const weatherRect = this.getWeatherRect();
    const label = this.weatherLabel();

    ctx.font = '14px system-ui';
    ctx.textAlign = 'left';
    const labelWidth = Math.min(ctx.measureText(label).width + 20, weatherRect.width);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    this.roundRect(ctx, weatherRect.x, weatherRect.y, labelWidth, weatherRect.height, 13);
    ctx.fill();

    ctx.fillStyle = '#4A5A6A';
    ctx.fillText(label, weatherRect.x + 10, weatherRect.y + 18);

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

    const compactScale = this.isMobile ? 0.85 : 1;
    const titleY = this.isMobile ? 30 : 80;

    // Title with shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.font = `bold ${Math.round(56 * compactScale)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(t('title'), centerX + 3, titleY + 3);

    ctx.fillStyle = '#2D5A1F';
    ctx.fillText(t('title'), centerX, titleY);

    // Subtitle
    ctx.fillStyle = '#555';
    ctx.font = `${Math.round(18 * compactScale)}px system-ui`;
    ctx.fillText(
      this.menuView === 'practice' ? t('practiceAnyTable') : t('subtitle'),
      centerX, titleY + 30
    );

    if (this.menuView === 'daily') {
      this.renderDailyMenu();
      return;
    }

    // Shared layout (also used for hit testing in handleClick)
    const layout = this.getMenuLayout();
    const { compact } = layout;

    // Table selection card
    const { cardX, cardY, cardWidth, cardHeight } = layout;

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
    const { cols, cellWidth, cellHeight, gap, gridStartX, gridStartY } = layout;

    for (let i = 0; i < TABLE_COUNT; i++) {
      const table = i + MIN_TABLE;
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

      // Best speed and personal best score badges
      const personalBest = this.highscores.getBestScore(table);
      if (bestSpeed > 0 || personalBest > 0) {
        ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.85)' : '#666';
        ctx.font = `${Math.round(11 * compact)}px system-ui`;

        const badges = [];
        if (bestSpeed > 0) badges.push(`${t('best')}: ${bestSpeed}`);
        if (personalBest > 0) badges.push(`★${personalBest}`);

        ctx.fillText(badges.join('  '), cellX + cellWidth / 2, cellY + Math.round(45 * compact));
      }
    }

    // Speed selector card
    const { speedCardY, speedCardHeight } = layout;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.roundRect(ctx, cardX, speedCardY, cardWidth, speedCardHeight, 15);
    ctx.fill();

    // Speed display
    ctx.fillStyle = '#333';
    ctx.font = `bold ${Math.round(16 * compact)}px system-ui`;
    ctx.fillText(t('speedLevel'), centerX, speedCardY + Math.round(22 * compact));

    // Speed arrows and value
    ctx.font = `${Math.round(24 * compact)}px system-ui`;
    ctx.fillStyle = '#888';
    ctx.fillText('◀', centerX - 60, speedCardY + Math.round(52 * compact));
    ctx.fillText('▶', centerX + 60, speedCardY + Math.round(52 * compact));

    ctx.font = `bold ${Math.round(32 * compact)}px system-ui`;
    ctx.fillStyle = '#4CAF50';
    ctx.fillText(this.selectedSpeed.toString(), centerX, speedCardY + Math.round(50 * compact));

    // Start and back buttons, side by side
    const { btnY, btnWidth, btnHeight, startBtnX, highscoreBtnX } = layout;

    this.renderButton(
      startBtnX, btnY, btnWidth, btnHeight,
      t('startGame'), Math.round(26 * compact),
      ['#66BB6A', '#43A047']
    );
    this.renderButton(
      highscoreBtnX, btnY, btnWidth, btnHeight,
      `← ${t('back')}`, Math.round(20 * compact),
      ['#B0BEC5', '#90A4AE']
    );

    // Instructions - different for mobile vs desktop
    const hintY = btnY + btnHeight + Math.round(30 * compact);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#999';
    ctx.font = `${Math.round(13 * compact)}px system-ui`;
    if (this.isMobile) {
      ctx.fillText(`${t('practice')} - tap a table, then start`, centerX, hintY);
    } else {
      ctx.fillText('Number or arrow keys to pick a table  •  ESC to go back', centerX, hintY);
    }
  }

  // The daily view: today's table, the speed picker and the way into practice.
  renderDailyMenu() {
    const ctx = this.ctx;
    const layout = this.getDailyLayout();
    const { centerX, compact, cardX, cardY, cardWidth, cardHeight } = layout;

    // Card shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.roundRect(ctx, cardX + 4, cardY + 4, cardWidth, cardHeight, 15);
    ctx.fill();

    // Card background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15);
    ctx.fill();

    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    this.roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 15);
    ctx.stroke();

    ctx.textAlign = 'center';

    // Heading and today's date
    ctx.fillStyle = '#B8860B';
    ctx.font = `bold ${Math.round(15 * compact)}px system-ui`;
    ctx.fillText(`📅 ${t('tableOfTheDay')}`, centerX, cardY + Math.round(26 * compact));

    ctx.fillStyle = '#999';
    ctx.font = `${Math.round(12 * compact)}px system-ui`;
    ctx.fillText(this.formatToday(), centerX, cardY + Math.round(44 * compact));

    // The table itself
    ctx.fillStyle = '#2D5A1F';
    ctx.font = `bold ${Math.round(58 * compact)}px system-ui`;
    ctx.fillText(`${this.dailyTable}×`, centerX, cardY + Math.round(100 * compact));

    // Your best on this table, and when the next one arrives
    const best = this.highscores.getBestScore(this.dailyTable);
    const bestSpeed = this.progress.getBestSpeed(this.dailyTable);

    ctx.font = `${Math.round(13 * compact)}px system-ui`;
    ctx.fillStyle = '#666';
    const facts = [];
    if (best > 0) facts.push(`★ ${t('yourBest')}: ${best}`);
    if (bestSpeed > 0) facts.push(`${t('best')} ${t('speed').toLowerCase()}: ${bestSpeed}`);
    ctx.fillText(
      facts.length > 0 ? facts.join('   ·   ') : t('everyonePlaysToday'),
      centerX, cardY + Math.round(126 * compact)
    );

    ctx.fillStyle = '#AAA';
    ctx.font = `${Math.round(11 * compact)}px system-ui`;
    ctx.fillText(
      `⏳ ${t('newTableIn')} ${formatTimeUntilNextTable()}`,
      centerX, cardY + Math.round(145 * compact)
    );

    // Speed selector card
    const { speedCardY, speedCardHeight } = layout;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    this.roundRect(ctx, cardX, speedCardY, cardWidth, speedCardHeight, 15);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.font = `bold ${Math.round(16 * compact)}px system-ui`;
    ctx.fillText(t('speedLevel'), centerX, speedCardY + Math.round(22 * compact));

    ctx.font = `${Math.round(24 * compact)}px system-ui`;
    ctx.fillStyle = '#888';
    ctx.fillText('◀', centerX - 60, speedCardY + Math.round(52 * compact));
    ctx.fillText('▶', centerX + 60, speedCardY + Math.round(52 * compact));

    ctx.font = `bold ${Math.round(32 * compact)}px system-ui`;
    ctx.fillStyle = '#4CAF50';
    ctx.fillText(this.selectedSpeed.toString(), centerX, speedCardY + Math.round(50 * compact));

    // Start / highscores / practice
    const { btnY, btnWidth, btnHeight, startBtnX, highscoreBtnX } = layout;
    this.renderButton(
      startBtnX, btnY, btnWidth, btnHeight,
      t('startGame'), Math.round(26 * compact),
      ['#66BB6A', '#43A047']
    );
    this.renderButton(
      highscoreBtnX, btnY, btnWidth, btnHeight,
      `🏆 ${t('highscores')}`, Math.round(19 * compact),
      ['#5C6BC0', '#3949AB']
    );
    this.renderButton(
      layout.practiceBtnX, layout.practiceBtnY, layout.practiceBtnWidth, layout.practiceBtnHeight,
      `🎯 ${t('practice')}`, Math.round(15 * compact),
      ['#FFFFFF', '#ECEFF1'],
      { color: '#546E7A', border: '#CFD8DC' }
    );

    // Bird skins - unlocked by beating your own local highscores
    this.renderSkinPicker(layout);

    const hintY = layout.skinY + layout.skinSize + Math.round(36 * compact);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#999';
    ctx.font = `${Math.round(13 * compact)}px system-ui`;
    if (this.isMobile) {
      ctx.fillText('Tap to start', centerX, hintY);
    } else {
      ctx.fillText('SPACE to start  •  H for highscores', centerX, hintY);
    }
  }

  // Today's date in the player's language, e.g. "Thu 17 Sep".
  formatToday() {
    const locale = getLanguage() === 'sv' ? 'sv-SE' : 'en-GB';

    try {
      return new Date().toLocaleDateString(locale, {
        weekday: 'short', day: 'numeric', month: 'short'
      });
    } catch (e) {
      return this.dayKey;
    }
  }

  // Rounded gradient button with a shadow and centered label.
  renderButton(x, y, width, height, label, fontSize, [from, to], options = {}) {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.roundRect(ctx, x + 3, y + 3, width, height, 12);
    ctx.fill();

    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    this.roundRect(ctx, x, y, width, height, 12);
    ctx.fill();

    if (options.border) {
      ctx.strokeStyle = options.border;
      ctx.lineWidth = 2;
      this.roundRect(ctx, x, y, width, height, 12);
      ctx.stroke();
    }

    ctx.fillStyle = options.color || '#FFF';
    ctx.font = `bold ${fontSize}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + width / 2, y + height / 2 + fontSize * 0.36);
  }

  renderSkinPicker(layout) {
    const ctx = this.ctx;
    const { skinSize, skinGap, skinStartX, skinY, compact, centerX } = layout;
    const selectedId = this.skins.getSelectedId();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#777';
    ctx.font = `bold ${Math.round(12 * compact)}px system-ui`;
    ctx.fillText(t('birds'), centerX, skinY - Math.round(6 * compact));

    this.skins.getAll().forEach((skin, i) => {
      const x = skinStartX + i * (skinSize + skinGap);
      const isSelected = skin.id === selectedId;

      ctx.fillStyle = skin.unlocked ? 'rgba(255, 255, 255, 0.9)' : 'rgba(220, 220, 220, 0.75)';
      this.roundRect(ctx, x, skinY, skinSize, skinSize, 8);
      ctx.fill();

      ctx.strokeStyle = isSelected ? '#4CAF50' : '#DDD';
      ctx.lineWidth = isSelected ? 3 : 1;
      this.roundRect(ctx, x, skinY, skinSize, skinSize, 8);
      ctx.stroke();

      if (skin.unlocked) {
        ctx.save();
        ctx.translate(x + skinSize / 2 - 1, skinY + skinSize / 2);
        drawBirdShape(ctx, skinSize * 0.62, skin.colors);
        ctx.restore();
      } else {
        ctx.fillStyle = '#AAA';
        ctx.font = `${Math.round(15 * compact)}px system-ui`;
        ctx.fillText('🔒', x + skinSize / 2, skinY + skinSize / 2 + 6);
      }
    });

    if (this.skins.hasLockedSkins()) {
      ctx.fillStyle = '#AAA';
      ctx.font = `${Math.round(11 * compact)}px system-ui`;
      ctx.fillText(t('lockedBird'), centerX, skinY + skinSize + Math.round(12 * compact));
    }
  }

  // The highscore screen: a local list to beat your own runs, and a global one
  // to compare with friends.
  renderHighscores() {
    const ctx = this.ctx;
    const layout = this.getHighscoreLayout();
    const { centerX, compact, panelX, panelY, panelWidth, panelHeight } = layout;

    // Dim the sky behind the panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Panel
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    this.roundRect(ctx, panelX, panelY, panelWidth, panelHeight, 18);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#2D5A1F';
    ctx.font = `bold ${Math.round(30 * compact)}px system-ui`;
    ctx.fillText(`🏆 ${t('highscores')}`, centerX, panelY + Math.round(38 * compact));

    // Tabs
    const isLocal = this.highscoreTab === 'local';
    this.renderTab(layout.localTabX, layout.tabY, layout.tabWidth, layout.tabHeight, t('localTab'), isLocal, compact);
    this.renderTab(layout.globalTabX, layout.tabY, layout.tabWidth, layout.tabHeight, t('globalTab'), !isLocal, compact);

    // Table selector: one list per table, plus an all-tables view
    const isToday = this.highscoreTable === this.dailyTable;
    const filterLabel = this.highscoreTable === null
      ? t('allTables')
      : `${this.highscoreTable}× ${t('tableAt')}${isToday ? ` · ${t('todayShort')}` : ''}`;

    ctx.fillStyle = '#EEF1F8';
    this.roundRect(ctx, layout.filterX, layout.filterY, layout.filterWidth, layout.filterHeight, 13);
    ctx.fill();
    ctx.strokeStyle = isToday ? '#FFC107' : '#C8CFE0';
    ctx.lineWidth = isToday ? 2 : 1;
    this.roundRect(ctx, layout.filterX, layout.filterY, layout.filterWidth, layout.filterHeight, 13);
    ctx.stroke();

    ctx.fillStyle = '#42507A';
    ctx.font = `bold ${Math.round(13 * compact)}px system-ui`;
    ctx.fillText(filterLabel, centerX, layout.filterY + layout.filterHeight / 2 + 5);

    ctx.fillStyle = '#8A93AC';
    ctx.font = `${Math.round(16 * compact)}px system-ui`;
    ctx.fillText('◀', layout.prevTableX + layout.filterArrowWidth / 2, layout.filterY + layout.filterHeight / 2 + 6);
    ctx.fillText('▶', layout.nextTableX + layout.filterArrowWidth / 2, layout.filterY + layout.filterHeight / 2 + 6);

    if (isLocal) {
      this.renderLocalScores(layout);
    } else {
      this.renderGlobalScores(layout);
    }

    // Footer: name button (global identity) and back
    const nameLabel = this.player.hasName() ? `👤 ${this.player.getName()}` : t('setName');
    this.renderButton(
      layout.nameBtnX, layout.footerY, layout.nameBtnWidth, layout.footerHeight,
      nameLabel, Math.round(14 * compact), ['#ECEFF6', '#DCE1EE'],
      { color: '#42507A' }
    );
    this.renderButton(
      layout.backBtnX, layout.footerY, layout.backBtnWidth, layout.footerHeight,
      t('back'), Math.round(16 * compact), ['#66BB6A', '#43A047']
    );
  }

  renderTab(x, y, width, height, label, isActive, compact) {
    const ctx = this.ctx;

    ctx.fillStyle = isActive ? '#3949AB' : '#E8EAF2';
    this.roundRect(ctx, x, y, width, height, 10);
    ctx.fill();

    ctx.fillStyle = isActive ? '#FFF' : '#666';
    ctx.font = `bold ${Math.round(15 * compact)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + width / 2, y + height / 2 + 5);
  }

  renderLocalScores(layout) {
    const entries = this.highscoreTable === null
      ? this.highscores.getTop(layout.maxRows)
      : this.highscores.getForTable(this.highscoreTable, layout.maxRows);

    if (entries.length === 0) {
      this.renderScoreMessage(layout, t('noScoresYet'));
      return;
    }

    this.renderScoreRows(layout, entries, { highlightAll: true });
  }

  renderGlobalScores(layout) {
    const { status, entries, error } = this.globalList;

    if (status === 'loading') {
      this.renderScoreMessage(layout, t('loadingScores'));
      return;
    }

    if (status === 'error') {
      const message = error === 'unavailable' ? t('globalUnavailable') : t('globalOffline');
      this.renderScoreMessage(layout, message);
      return;
    }

    if (entries.length === 0) {
      this.renderScoreMessage(layout, t('noScoresYet'));
      return;
    }

    const myName = this.player.getName().toLowerCase();
    this.renderScoreRows(layout, entries.slice(0, layout.maxRows), {
      isMine: entry => Boolean(myName) && entry.name.toLowerCase() === myName
    });
  }

  renderScoreMessage(layout, message) {
    const ctx = this.ctx;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#9AA3B8';
    ctx.font = `${Math.round(15 * layout.compact)}px system-ui`;
    ctx.fillText(message, layout.centerX, layout.rowsY + Math.round(40 * layout.compact));
  }

  renderScoreRows(layout, entries, { highlightAll = false, isMine = () => false } = {}) {
    const ctx = this.ctx;
    const { panelX, panelWidth, rowsY, rowHeight, compact } = layout;
    const rowX = panelX + 18;
    const rowWidth = panelWidth - 36;
    const medals = ['#FFD700', '#C0C0C0', '#CD7F32'];

    entries.forEach((entry, i) => {
      const y = rowsY + i * rowHeight;
      const mine = highlightAll || isMine(entry);

      if (mine) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.12)';
        this.roundRect(ctx, rowX, y, rowWidth, rowHeight - 4, 8);
        ctx.fill();
      }

      // Rank (medal colour for the top three)
      ctx.textAlign = 'left';
      ctx.fillStyle = medals[i] || '#98A2B8';
      ctx.font = `bold ${Math.round(14 * compact)}px system-ui`;
      ctx.fillText(`${i + 1}`, rowX + 10, y + rowHeight / 2 + 4);

      // Name
      ctx.fillStyle = '#333';
      ctx.font = `${Math.round(14 * compact)}px system-ui`;
      ctx.fillText(entry.name || t('you'), rowX + 36, y + rowHeight / 2 + 4);

      // Table and speed
      ctx.fillStyle = '#98A2B8';
      ctx.font = `${Math.round(12 * compact)}px system-ui`;
      ctx.fillText(`${entry.table}×  ·  ${t('speed')} ${entry.speed}`, rowX + rowWidth * 0.48, y + rowHeight / 2 + 4);

      // Score
      ctx.textAlign = 'right';
      ctx.fillStyle = '#2E7D32';
      ctx.font = `bold ${Math.round(16 * compact)}px system-ui`;
      ctx.fillText(`${entry.score}`, rowX + rowWidth - 12, y + rowHeight / 2 + 5);
    });

    ctx.textAlign = 'center';
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

      // Personal best line: what there was to beat, or what stands now
      const best = this.highscores.getBestScore(this.selectedTable);
      if (this.lastResult && this.lastResult.isPersonalBest) {
        ctx.fillStyle = '#B8860B';
        ctx.font = '14px system-ui';
        ctx.fillText(`${t('previousBest')}: ${this.lastResult.previousBest}`, centerX, cardY + 294);
      } else if (best > 0) {
        ctx.fillStyle = '#888';
        ctx.font = '14px system-ui';
        ctx.fillText(`${t('yourBest')}: ${best} (${this.selectedTable}×)`, centerX, cardY + 294);
      }

      // New record ribbon across the top of the card
      if (this.lastResult && this.lastResult.isPersonalBest) {
        const ribbonWidth = 260;
        const ribbonX = centerX - ribbonWidth / 2;
        const ribbonY = cardY - 22;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        this.roundRect(ctx, ribbonX + 3, ribbonY + 3, ribbonWidth, 40, 20);
        ctx.fill();

        const ribbon = ctx.createLinearGradient(ribbonX, ribbonY, ribbonX, ribbonY + 40);
        ribbon.addColorStop(0, '#FFE082');
        ribbon.addColorStop(1, '#FFB300');
        ctx.fillStyle = ribbon;
        this.roundRect(ctx, ribbonX, ribbonY, ribbonWidth, 40, 20);
        ctx.fill();

        ctx.fillStyle = '#7A4F00';
        ctx.font = 'bold 22px system-ui';
        ctx.fillText(`⭐ ${t('newRecord')}`, centerX, ribbonY + 28);
      }
    }

    this.renderRewardStrip(centerX);

    // Confetti sits above the card so the celebration reads as one moment.
    this.confetti.render(ctx);

    // Footer buttons: continue, highscores, and (when needed) set a name
    const buttons = this.getGameOverButtons();

    if (buttons.name) {
      this.renderButton(
        buttons.name.x, buttons.name.y, buttons.name.width, buttons.name.height,
        t('setName'), 15, ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.18)'],
        { border: 'rgba(255, 255, 255, 0.45)' }
      );
    }

    this.renderButton(
      buttons.playAgain.x, buttons.playAgain.y, buttons.playAgain.width, buttons.playAgain.height,
      `${t('playAgain')}  (SPACE)`, 15, ['#66BB6A', '#43A047']
    );

    this.renderButton(
      buttons.menu.x, buttons.menu.y, buttons.menu.width, buttons.menu.height,
      t('menu'), 15, ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.18)'],
      { border: 'rgba(255, 255, 255, 0.45)' }
    );

    this.renderButton(
      buttons.highscores.x, buttons.highscores.y, buttons.highscores.width, buttons.highscores.height,
      `🏆 ${t('highscores')}`, 15, ['#5C6BC0', '#3949AB']
    );
  }

  // Reward and global-rank feedback shown between the card and the buttons.
  renderRewardStrip(centerX) {
    const ctx = this.ctx;
    ctx.textAlign = 'center';

    if (this.unlockedSkin) {
      const label = `${t('skinUnlocked')}  ${this.unlockedSkin.name}`;

      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 17px system-ui';
      ctx.fillText(label, centerX + 16, 458);

      const textWidth = ctx.measureText(label).width;
      ctx.save();
      ctx.translate(centerX + 16 - textWidth / 2 - 26, 451);
      drawBirdShape(ctx, 26, this.unlockedSkin.colors);
      ctx.restore();
    }

    const submission = this.globalSubmission;
    if (!submission) return;

    ctx.font = '14px system-ui';

    if (submission.status === 'pending') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(t('sendingScore'), centerX, 482);
    } else if (submission.status === 'ok' && submission.rank) {
      ctx.fillStyle = '#90CAF9';
      ctx.fillText(`🌍 ${t('globalRank')}: #${submission.rank}`, centerX, 482);
    } else if (submission.status === 'no-name') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(t('nameNeeded'), centerX, 482);
    } else if (submission.status === 'error') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.fillText(t('globalOffline'), centerX, 482);
    }
  }
}

// Start game when DOM is ready. The instance is exposed for debugging from the
// browser console (window.game).
window.game = new Game();
