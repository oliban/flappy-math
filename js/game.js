import { BASE_HEIGHT, MIN_TABLE, MAX_TABLE } from './constants.js';
import { pipeSpeedFor } from './pace.js';
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
import { createPlayerProfile } from './player.js';
import { createHighscores, formatEntryDate } from './highscores.js';
import { drawAvatarSprite } from './avatar-sprites.js';
import * as Avatars from './avatars.js';
import { createUnlocks } from './unlocks.js';
import { createCharacterVoices } from './voices.js';
import { createConfetti } from './confetti.js';
import { getTableMascot } from './mascots.js';
import { createWeatherClient } from './weather.js';
import { createGlobalScores } from './globalScores.js';
import { getDailyTable, formatTimeUntilNextDay } from './weekly.js';
import { createRun, MODES } from './run.js';
import { createBackground } from './background.js';
import { createProfileUI } from './profile-ui.js';
import { routeFromLocation, HIGHSCORES_ROUTE, GALLERY_ROUTE } from './router.js';
import { runBenchmark } from './bench.js';
import { COLORS, font, emojiFont, roundRect, drawCard, drawButton, drawTitle, drawHeart, createHitAreas } from './ui.js';

const PIPE_SPACING = 500;
const STEP_MS = 1000 / 60;   // simulation step
const MAX_STEPS = 4;         // cap catch-up after a stall so the bird never teleports
// FPS overlay for on-device checks: open the game with ?fps (or #fps) in the URL
const SHOW_FPS = /(\?|&|#)(fps|bench)\b/.test(window.location.search + window.location.hash);
const RUN_BENCH = /(\?|&)bench\b/.test(window.location.search);

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
    this.characterVoices = createCharacterVoices(() => this.sound.engine.context());
    this.voice = createVoicePlayer();
    this.voice.init();
    this.voice.setLanguage(getLanguage());
    this.profile = createPlayerProfile();
    this.highscores = createHighscores();
    this.allAvatarIds = Avatars.AVATARS.map(a => a.id);
    this.starterIds = Avatars.STARTER_IDS || this.allAvatarIds;
    this.unlocks = createUnlocks({ starterIds: this.starterIds, allIds: this.allAvatarIds });
    this.toast = null;          // { avatarId, title, until }
    this.confetti = createConfetti();
    this.weather = null;
    this.weatherClient = createWeatherClient({ override: new URLSearchParams(window.location.search).get('weather') });
    this.locationChoice = this.readLocationChoice(); // 'granted' | 'denied' | null
    this.showLocationCard = false;
    this.globalScores = createGlobalScores();
    this.global = { status: 'idle', entries: [], fetchedAt: 0 }; // shared leaderboard cache
    this.highscoreTab = 'local'; // 'local' | 'global'
    this.highscoreTable = getDailyTable(); // null = all tables
    this.dailyTable = getDailyTable();
    this.globalRank = null;
    this.isPersonalBest = false;
    this.unlockedThisRun = null;
    this.galleryPage = 0;
    this.secretTaps = 0;
    this.secretTapTime = 0;
    this.background = createBackground();
    this.hitAreas = createHitAreas();

    this.pipes = [];
    this.currentProblem = null;
    this.run = null;
    this.lastRank = null;
    this.hasFlapped = false;

    // Menu state
    this.menuView = 'daily'; // 'daily' | 'practice'
    this.selectedTable = 2;
    this.selectedSpeed = 1;

    this.showMasteryMessage = false;
    this.fadeOut = 0;
    this.isFadingOut = false;

    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.profileUI = createProfileUI(this.profile, {
      onDone: () => this.onProfileDone(),
      onBack: () => this.state.returnToMenu(),
      isUnlocked: (id) => this.unlocks.isUnlocked(id)
    });

    this.loadProgress();
    this.applyAvatar();
    this.translateStaticDom();
    this.setupCanvas();
    this.setupInput();

    this.lastTime = 0;
    this.frameCount = 0;
    this.fpsLastTime = 0;
    this.currentFPS = 0;
    this.gameLoop = this.gameLoop.bind(this);

    this.preloadAllVoiceAudio();
    this.refreshWeather();
    setInterval(() => this.refreshWeather(), 10 * 60 * 1000);
    if (this.locationChoice === 'granted') this.requestPosition();

    if (document.fonts && document.fonts.load) {
      document.fonts.load("700 20px 'Fredoka'").catch(() => {});
    }

    // Weekly character drop (one per device per ISO week)
    const dropped = this.unlocks.claimWeeklyDrop();
    if (dropped) this.showToast(dropped, t('newCharacter'));

    // Deep link (e.g. /#highscores) wins over the first-launch profile prompt
    const route = routeFromLocation(window.location);
    if (route === HIGHSCORES_ROUTE) {
      this.state.openHighscores();
    } else if (route === GALLERY_ROUTE) {
      this.state.openGallery();
    } else if (!this.profile.hasName()) {
      this.state.openProfile();
      this.profileUI.show({ allowBack: false });
    }
    window.addEventListener('hashchange', () => this.onHashChange());
    this.lastSyncedState = null;

    requestAnimationFrame(this.gameLoop);

    if (RUN_BENCH) {
      this.profileUI.hide();
      this.state.returnToMenu();
      setTimeout(() => runBenchmark(this), 800);
    }
  }

  // ---------- Setup ----------

  loadProgress() {
    const saved = this.storage.load();
    if (saved) this.progress.import(saved);
  }

  saveProgress() {
    this.storage.save(this.progress.export());
  }

  applyAvatar() {
    this.bird.setAvatar(this.profile.getAvatarId());
  }

  // Offscreen panel cache: re-render only when `key` (the panel's content) changes.
  // Text-heavy HUD panels are expensive to rasterize every frame on mobile Safari.
  cachedPanel(name, key, width, height, draw) {
    this.panels = this.panels || new Map();
    let entry = this.panels.get(name);
    if (!entry || entry.key !== key || entry.canvas.width !== width * 2 || entry.canvas.height !== height * 2) {
      const canvas = entry ? entry.canvas : document.createElement('canvas');
      canvas.width = width * 2;   // 2x for retina crispness
      canvas.height = height * 2;
      const c = canvas.getContext('2d');
      c.setTransform(2, 0, 0, 2, 0, 0);
      c.clearRect(0, 0, width, height);
      draw(c, width, height);
      entry = { key, canvas };
      this.panels.set(name, entry);
    }
    return entry.canvas;
  }

  blitPanel(canvas, x, y) {
    this.ctx.drawImage(canvas, x, y, canvas.width / 2, canvas.height / 2);
  }

  // Draw the player's (or any) avatar as a UI element with a gentle idle animation
  drawAvatarAt(x, y, r, id = this.profile.getAvatarId()) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    drawAvatarSprite(ctx, id, r, performance.now() / 180);
    ctx.restore();
  }

  translateStaticDom() {
    document.getElementById('rotate-title').textContent = t('rotateTitle');
    document.getElementById('rotate-body').textContent = t('rotateBody');
    document.documentElement.lang = getLanguage();
  }

  onHashChange() {
    const route = routeFromLocation(window.location);
    const state = this.state.current();
    if (state === STATES.PLAYING) return;
    if (route === HIGHSCORES_ROUTE && state !== STATES.HIGHSCORES) {
      this.state.returnToMenu();
      this.state.openHighscores();
    } else if (route === GALLERY_ROUTE && state !== STATES.GALLERY) {
      this.state.returnToMenu();
      this.state.openGallery();
    } else if (route === null && (state === STATES.HIGHSCORES || state === STATES.GALLERY)) {
      this.state.returnToMenu();
    }
  }

  // Keep the URL hash in step with the screen so the highscore page is linkable
  syncUrlWithState() {
    const state = this.state.current();
    if (state === this.lastSyncedState) return;
    this.lastSyncedState = state;
    const wantHash = state === STATES.HIGHSCORES ? '#highscores' : state === STATES.GALLERY ? '#gallery' : '';
    const current = window.location.hash;
    if (wantHash !== current && (wantHash || routeFromLocation(window.location) !== null)) {
      history.replaceState(null, '', window.location.pathname + window.location.search + wantHash);
    }
    // Returning to the menu on first launch still needs a player name
    if (state === STATES.MENU && !this.profile.hasName() && !this.profileUI.isVisible()) {
      this.state.openProfile();
      this.profileUI.show({ allowBack: false });
    }
  }

  // Real weather where the player is shapes the sky, clouds, rain/snow and wind.
  // Without browser coordinates the server geolocates by IP, falling back to Mölndal.
  refreshWeather() {
    this.weatherClient.fetch(this.coords || null).then(w => {
      this.weather = w;
      this.background.setWeather(w);
      console.info(`[weather] applied: ${w.condition}${w.isDay ? '' : ' (night)'} in ${w.place}, ${w.temperature ?? '?'}°, wind ${w.windSpeed} km/h`);
    });
  }

  readLocationChoice() {
    try { return localStorage.getItem('flappy-math-location'); } catch (e) { return null; }
  }

  saveLocationChoice(choice) {
    this.locationChoice = choice;
    try { localStorage.setItem('flappy-math-location', choice); } catch (e) { /* ignore */ }
  }

  // Ask the browser for a position (the browser shows its own permission prompt).
  // Only called after the player said yes on our explanation card.
  requestPosition() {
    if (!navigator.geolocation) { console.warn('[weather] geolocation not available in this browser'); return; }
    console.info('[weather] asking the browser for the position…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        console.info(`[weather] position received (±${Math.round(pos.coords.accuracy)} m); refreshing weather with rounded coordinates`);
        this.refreshWeather();
      },
      (err) => { console.warn(`[weather] position not available (${err && err.message}); keeping the server-decided weather`); },
      { timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  }

  renderLocationCard() {
    const ctx = this.ctx;
    const W = this.canvasWidth;
    const cx = W / 2;
    ctx.fillStyle = 'rgba(31, 42, 68, 0.45)';
    ctx.fillRect(0, 0, W, this.canvasHeight);
    const cardW = Math.min(520, W - 40);
    const cardH = 250;
    const cardX = cx - cardW / 2;
    const cardY = this.canvasHeight / 2 - cardH / 2;
    drawCard(ctx, cardX, cardY, cardW, cardH, { radius: 24 });
    ctx.textAlign = 'center';
    ctx.font = emojiFont(40);
    ctx.fillText('📍', cx, cardY + 56);
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(24, '700');
    ctx.fillText(t('locationTitle'), cx, cardY + 96);
    ctx.fillStyle = COLORS.inkSoft;
    ctx.font = font(14, '600');
    ctx.fillText(t('locationBody1'), cx, cardY + 126);
    ctx.fillText(t('locationBody2'), cx, cardY + 148);
    const btnY = cardY + cardH - 52 - 18;
    const yes = drawButton(ctx, cx - 240, btnY, 230, 52, t('locationYes'), { fontSize: 17, icon: '✅' });
    this.hitAreas.add(yes, () => { this.showLocationCard = false; this.saveLocationChoice('granted'); this.requestPosition(); });
    const no = drawButton(ctx, cx + 10, btnY, 230, 52, t('locationNo'),
      { color: COLORS.muted, dark: COLORS.mutedBorder, textColor: COLORS.inkSoft, fontSize: 17 });
    this.hitAreas.add(no, () => { this.showLocationCard = false; this.saveLocationChoice('denied'); console.info('[weather] location declined; using IP/Mölndal weather'); });
    // Swallow clicks on the rest of the screen while the card is up
    this.hitAreas.add({ x: 0, y: 0, width: W, height: this.canvasHeight }, () => {});
    // Re-add the buttons on top so they win the hit test
    this.hitAreas.add(yes, () => { this.showLocationCard = false; this.saveLocationChoice('granted'); this.requestPosition(); });
    this.hitAreas.add(no, () => { this.showLocationCard = false; this.saveLocationChoice('denied'); });
  }

  weatherIcon(w) {
    if (!w.isDay && w.condition === 'clear') return '🌙';
    return { clear: '☀️', clouds: '⛅', overcast: '☁️', fog: '🌫️', rain: '🌧️', snow: '❄️', thunder: '⛈️' }[w.condition] || '☀️';
  }

  renderWeatherChip() {
    const w = this.weather;
    if (!w) return;
    const ctx = this.ctx;
    const label = `${this.weatherIcon(w)} ${t('weatherIn')} ${w.place}: ${t(`weather_${w.condition}`)}${w.temperature !== null ? `, ${w.temperature}°` : ''}`;
    ctx.font = font(13, '600');
    const wdt = Math.ceil(ctx.measureText(label).width) + 24;
    const x = this.canvasWidth - 16 - wdt;
    const y = 66;
    drawCard(ctx, x, y, wdt, 26, { radius: 13, shadow: false, fill: 'rgba(255,255,255,0.85)' });
    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 12, y + 13);
    ctx.textBaseline = 'alphabetic';
    this.hitAreas.add({ x, y, width: wdt, height: 26 }, () => { this.showLocationCard = true; });
  }

  showToast(avatarId, title, { selectable = true } = {}) {
    const duration = 6000;
    this.toast = { avatarId, title, until: performance.now() + duration, duration, selectable };
  }

  isHovered(rect) {
    const p = this.pointer;
    return !!p && p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
  }

  // Make an unlocked character clickable: hover ring + click selects it as the avatar
  addSelectableCharacter(rect, avatarId) {
    const ctx = this.ctx;
    if (this.isHovered(rect)) {
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      roundRect(ctx, rect.x - 3, rect.y - 3, rect.width + 6, rect.height + 6, 22);
      ctx.stroke();
    }
    this.hitAreas.add(rect, () => {
      this.profile.setAvatar(avatarId);
      this.applyAvatar();
      this.showToast(avatarId, t('nowPlayingAs'), { selectable: false });
    });
  }

  openGallery() {
    this.galleryPage = 0;
    this.state.openGallery();
  }

  onProfileDone() {
    this.applyAvatar();
    this.state.returnToMenu();
  }

  setupCanvas() {
    this.updateCanvasSize();
    window.addEventListener('resize', () => this.updateCanvasSize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.updateCanvasSize(), 100));
  }

  updateCanvasSize() {
    const container = document.getElementById('game-container');
    const cssWidth = container.clientWidth || window.innerWidth;
    const cssHeight = container.clientHeight || window.innerHeight;
    const viewportAspect = cssWidth / cssHeight;

    // Internal resolution: the game is laid out in a 600-unit-tall space; the
    // backing store may be smaller (renderScale < 1) and scaled up via CSS.
    this.renderHeight = this.renderHeight || BASE_HEIGHT;
    this.renderScale = this.renderHeight / BASE_HEIGHT;
    this.canvasHeight = BASE_HEIGHT;
    this.canvasWidth = Math.max(640, Math.round(BASE_HEIGHT * viewportAspect));

    this.canvas.width = Math.round(this.canvasWidth * this.renderScale);
    this.canvas.height = Math.round(this.canvasHeight * this.renderScale);
    this.canvas.style.width = `${cssWidth}px`;
    this.canvas.style.height = `${cssHeight}px`;
    this.ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);

    // How many canvas units one CSS pixel covers; >1 means a small physical screen
    this.pixelRatio = this.canvasHeight / cssHeight;
  }

  // Change the backing-store height (e.g. 400 for a low-power mode). Layout units stay 600.
  setResolutionHeight(height) {
    this.renderHeight = height;
    this.updateCanvasSize();
    this.panels = null; // HUD caches are per-resolution
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      if (this.profileUI.isVisible()) return;
      const state = this.state.current();

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.handlePrimaryAction();
        return;
      }

      if (e.code === 'Escape') {
        if (state !== STATES.MENU) {
          this.state.returnToMenu();
        } else if (this.menuView === 'practice') {
          this.menuView = 'daily';
        }
        return;
      }

      if (state === STATES.MENU && this.menuView === 'practice') {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 9) this.selectedTable = num;
        if (e.key === '0') this.selectedTable = 10;
        if (e.key === '-') this.selectedTable = 11;
        if (e.key === '=') this.selectedTable = 12;
        if (e.code === 'ArrowLeft') this.selectedTable = Math.max(this.selectedTable - 1, MIN_TABLE);
        if (e.code === 'ArrowRight') this.selectedTable = Math.min(this.selectedTable + 1, MAX_TABLE);
        if (e.code === 'ArrowUp') this.selectedSpeed = Math.min(this.selectedSpeed + 1, 99);
        if (e.code === 'ArrowDown') this.selectedSpeed = Math.max(this.selectedSpeed - 1, 1);
      }
    });

    // Pointer events cover mouse, touch and pen with one handler.
    // touch-action: none in CSS stops the browser from scrolling/zooming.
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.handlePointer(e);
    });
    // Hover tracking (mouse/pen): lets buttons and unlock cards highlight and show a pointer cursor
    this.pointer = null;
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.pointer = this.toCanvasCoords(e);
    });
    this.canvas.addEventListener('pointerleave', () => { this.pointer = null; });
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  toCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvasWidth / rect.width),
      y: (e.clientY - rect.top) * (this.canvasHeight / rect.height)
    };
  }

  handlePointer(e) {
    this.sound.unlock();
    const { x, y } = this.toCanvasCoords(e);
    const state = this.state.current();

    if (state === STATES.PLAYING) {
      this.flap();
      return;
    }

    const action = this.hitAreas.hit(x, y);
    if (action) action();
  }

  // Space / Enter / generic "go"
  handlePrimaryAction() {
    this.sound.unlock();
    const state = this.state.current();
    if (state === STATES.MENU) {
      if (this.menuView === 'practice') this.startPractice();
      else this.startDaily();
    } else if (state === STATES.PLAYING) {
      this.flap();
    } else if (state === STATES.GAME_OVER) {
      this.state.returnToMenu();
    } else if (state === STATES.HIGHSCORES || state === STATES.GALLERY) {
      this.state.returnToMenu();
    }
  }

  flap() {
    this.bird.flap();
    // Each character has its own jump voice; fall back to the flap sound if Web Audio is missing
    if (this.sound.engine.isAvailable()) {
      this.characterVoices.playJump(Avatars.getAvatar(this.profile.getAvatarId()));
    } else {
      this.sound.play('flap');
    }
    this.hasFlapped = true;
    if (this.currentProblem && !this.currentProblem.spoken) {
      this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
      this.currentProblem.spoken = true;
    }
  }

  // ---------- Game flow ----------

  startDaily() {
    this.run = createRun({ mode: MODES.DAILY, table: getDailyTable() });
    this.startGame();
  }

  startPractice() {
    this.run = createRun({ mode: MODES.PRACTICE, table: this.selectedTable, speed: this.selectedSpeed });
    this.startGame();
  }

  startGame() {
    this.state.startGame();
    this.bird.reset();
    this.scoring.reset();
    this.pipes = [];
    this.showMasteryMessage = false;
    this.lastRank = null;
    this.hasFlapped = false;
    this.fadeOut = 0;
    this.isFadingOut = false;
    this.fillScreenWithPipes();

    if (this.currentProblem) {
      this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
      this.currentProblem.spoken = true;
    }
  }

  preloadAllVoiceAudio() {
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
    const spacing = this.pipeSpacing();
    const startX = 150 + spacing;
    for (let x = startX; x <= this.canvasWidth; x += spacing) {
      this.spawnPipeAt(x);
    }
    this.updateCurrentProblem();
  }

  // Distance between pipes: a fixed fraction of the screen so ~2.5 pipes are visible on any aspect
  pipeSpacing() {
    return Math.max(PIPE_SPACING, Math.round(this.canvasWidth * 0.4));
  }

  spawnPipeAt(x) {
    const problem = generateProblemForTable(this.run.table);
    const pipe = createPipe(problem.answers, x);
    pipe.problem = problem;
    this.pipes.push(pipe);
  }

  spawnPipe() {
    this.spawnPipeAt(this.canvasWidth);
  }

  updateCurrentProblem() {
    const firstUnanswered = this.pipes.find(p => !p.passed);
    if (firstUnanswered && firstUnanswered.problem && this.currentProblem !== firstUnanswered.problem) {
      this.currentProblem = firstUnanswered.problem;
    }
  }

  getGameSpeed() {
    const level = this.run ? this.run.speed : 1;
    return pipeSpeedFor(level, this.canvasWidth);
  }

  gameLoop(timestamp) {
    // Frame statistics (shown with ?fps): fps, worst frame gap, long-frame count
    const gap = this.lastTime ? timestamp - this.lastTime : 16.7;
    this.lastTime = timestamp;
    this.frameCount++;
    this.worstGap = Math.max(this.worstGap || 0, gap);
    if (gap > 34) this.longFrames = (this.longFrames || 0) + 1;
    if (timestamp - this.fpsLastTime >= 1000) {
      // Midnight rollover: the table of the day changes without a reload
      const todayTable = getDailyTable();
      if (todayTable !== this.dailyTable) {
        if (this.highscoreTable === this.dailyTable) this.highscoreTable = todayTable;
        this.dailyTable = todayTable;
      }
      this.currentFPS = this.frameCount;
      this.shownWorstGap = Math.round(this.worstGap);
      this.shownLongFrames = this.longFrames || 0;
      this.frameCount = 0;
      this.worstGap = 0;
      this.longFrames = 0;
      this.fpsLastTime = timestamp;
    }

    // Fixed-timestep simulation: physics always advances in 60 Hz steps, so the
    // game runs at the same pace on 30, 60 and 120 Hz displays and after hiccups.
    this.accumulator = Math.min((this.accumulator || 0) + gap, STEP_MS * MAX_STEPS);
    while (this.accumulator >= STEP_MS) {
      this.update();
      this.accumulator -= STEP_MS;
    }

    this.render();
    this.syncUrlWithState();
    requestAnimationFrame(this.gameLoop);
  }

  loseLife() {
    this.sound.play('crash');
    this.scoring.hitPipe();
    if (this.scoring.isGameOver()) this.startFadeOut();
  }

  update() {
    this.confetti.update(1);
    if (this.state.current() !== STATES.PLAYING) {
      this.background.update(0.3);
      return;
    }

    this.bird.update();

    // Ceiling / floor: the bird is always pushed back into play
    if (this.bird.isOnCeiling()) {
      if (this.bird.hitCeiling()) this.loseLife();
    }
    if (this.bird.isOnFloor()) {
      if (this.bird.hitFloor()) this.loseLife();
    }

    const speed = this.getGameSpeed();
    this.background.update(speed);
    this.pipes.forEach(pipe => pipe.update(speed));

    let pipesRemoved = false;
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      if (this.pipes[i].isOffScreen()) {
        this.pipes.splice(i, 1);
        pipesRemoved = true;
      }
    }
    if (pipesRemoved) this.updateCurrentProblem();

    const lastPipe = this.pipes[this.pipes.length - 1];
    if (!lastPipe || lastPipe.x <= this.canvasWidth - this.pipeSpacing()) {
      this.spawnPipe();
    }

    for (const pipe of this.pipes) {
      const result = checkCollision(this.bird, pipe);

      if (result.type === CollisionResult.PIPE) {
        if (this.bird.canBeHurt()) {
          this.bird.bounce();
          if (!pipe.damagedPlayer) {
            pipe.damagedPlayer = true;
            this.loseLife();
          }
        }
      } else if (result.type === CollisionResult.PIPE_EDGE) {
        if (this.bird.canBeHurt()) {
          this.bird.bounce();
          this.sound.play('thud');
        }
      } else if (result.type === CollisionResult.GAP && !pipe.passed) {
        pipe.markPassed();
        const isCorrect = result.answer === this.currentProblem.correctAnswer;
        pipe.markGapHit(result.answer, isCorrect);
        this.updateCurrentProblem();

        if (isCorrect) {
          this.onCorrect(result.answer);
        } else {
          this.onWrong();
        }
      }
    }

    if (this.isFadingOut) {
      this.fadeOut += 1 / 120;
      if (this.fadeOut >= 1) this.endGame();
    }
  }

  onCorrect(answer) {
    this.scoring.correctAnswer();
    this.run.onCorrect();

    const slow = this.run.speed <= 7;
    if (slow) {
      this.sound.play('correct');
      this.voice.speakAnswer(answer);
      if (this.currentProblem) {
        const problem = this.currentProblem;
        problem.spoken = true;
        setTimeout(() => this.voice.speakQuestion(problem.a, problem.b), 1000);
      }
    } else {
      if (this.currentProblem) {
        this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
        this.currentProblem.spoken = true;
      }
      this.sound.play('correct');
    }

    if (this.run.endsOnMastery() && this.scoring.hasMastered()) {
      this.progress.updateBestSpeed(this.run.table, this.run.speed);
      this.saveProgress();
      this.showMasteryMessage = true;
      this.sound.play('mastery');
      this.startFadeOut();
    }
  }

  onWrong() {
    this.scoring.wrongAnswer();
    this.run.onWrong();

    const slow = this.run.speed <= 7;
    if (slow) {
      this.sound.play('wrong');
      if (this.currentProblem && !this.scoring.isGameOver()) {
        const problem = this.currentProblem;
        problem.spoken = true;
        setTimeout(() => this.voice.speakQuestion(problem.a, problem.b), 1000);
      }
    } else {
      if (this.currentProblem && !this.scoring.isGameOver()) {
        this.voice.speakQuestion(this.currentProblem.a, this.currentProblem.b);
        this.currentProblem.spoken = true;
      }
      this.sound.play('wrong');
    }

    if (this.scoring.isGameOver()) this.startFadeOut();
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

    this.isPersonalBest = false;
    this.globalRank = null;
    if (this.run.countsForHighscore()) {
      const name = this.profile.getName();
      const previousBest = this.highscores.bestScoreFor(name);
      this.lastRank = this.highscores.add({
        name,
        avatar: this.profile.getAvatarId(),
        score: this.scoring.score,
        table: this.run.table,
        maxSpeed: this.run.maxSpeed
      });
      this.isPersonalBest = this.scoring.score > 0 && this.scoring.score > previousBest;
      this.submitToGlobal();
    }

    this.unlockedThisRun = null;
    if (this.lastRank === 1) {
      const id = this.unlocks.claimHighscoreUnlock();
      if (id) {
        this.unlockedThisRun = id;
        this.showToast(id, t('newCharacter'));
      }
    }

    if (this.isPersonalBest) {
      this.celebrateRecord();
    } else if (!this.showMasteryMessage) {
      this.sound.play('gameover');
    }
  }

  // Fanfare and confetti cannons for beating your own best score
  celebrateRecord() {
    this.sound.play('fanfare');
    this.confetti.clear();
    const floor = this.canvasHeight + 10;
    const cannonSpeed = this.canvasHeight / 42;
    this.confetti.burst({ x: 40, y: floor, count: 70, angle: -Math.PI / 2.6, spread: Math.PI / 5, speed: cannonSpeed });
    this.confetti.burst({ x: this.canvasWidth - 40, y: floor, count: 70, angle: -Math.PI + Math.PI / 2.6, spread: Math.PI / 5, speed: cannonSpeed });
    this.confetti.burst({ x: this.canvasWidth / 2, y: 120, count: 50, angle: -Math.PI / 2, spread: Math.PI * 1.6, speed: cannonSpeed * 0.55 });
  }

  // Offer the finished daily run to the shared leaderboard (fails silently offline)
  submitToGlobal() {
    if (!this.globalScores.isAvailable() || this.scoring.score <= 0) return;
    const run = this.run;
    const score = this.scoring.score;
    this.globalScores.submit({
      name: this.profile.getName(),
      avatar: this.profile.getAvatarId(),
      score,
      table: run.table,
      speed: run.maxSpeed,
      streak: this.scoring.bestStreak
    }).then(result => {
      if (!result.ok) return;
      if (this.run === run && this.scoring.score === score) this.globalRank = result.rank;
      this.highscoreTable = run.table;
      this.global = { status: 'ok', entries: result.entries, fetchedAt: performance.now() };
    });
  }

  refreshGlobal(force = false) {
    if (!this.globalScores.isAvailable()) {
      this.global = { status: 'error', entries: [], fetchedAt: performance.now() };
      return;
    }
    const stale = performance.now() - this.global.fetchedAt > 30000;
    if (this.global.status === 'loading' || (!force && !stale && this.global.status !== 'idle')) return;
    this.global = { ...this.global, status: 'loading' };
    const table = this.highscoreTable;
    this.globalScores.fetchTop({ table, limit: 10 }).then(result => {
      if (this.highscoreTable !== table) return; // filter changed meanwhile
      this.global = result.ok
        ? { status: 'ok', entries: result.entries, fetchedAt: performance.now() }
        : { status: 'error', entries: [], fetchedAt: performance.now() };
    });
  }

  // ---------- Rendering ----------

  render() {
    const ctx = this.ctx;
    this.hitAreas.clear();
    this.background.render(ctx, this.canvasWidth);

    const state = this.state.current();
    if (state === STATES.MENU || state === STATES.PROFILE) {
      this.renderMenu();
    } else if (state === STATES.PLAYING) {
      this.renderGame();
      if (this.isFadingOut) {
        ctx.fillStyle = `rgba(31, 42, 68, ${this.fadeOut * 0.8})`;
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
      }
    } else if (state === STATES.GAME_OVER) {
      this.renderGameOver();
    } else if (state === STATES.HIGHSCORES) {
      this.renderHighscores();
    } else if (state === STATES.GALLERY) {
      this.renderGallery();
    }

    this.renderToast();

    // Pointer cursor over anything clickable
    const overButton = this.pointer && this.hitAreas.hit(this.pointer.x, this.pointer.y);
    this.canvas.style.cursor = overButton ? 'pointer' : 'default';

    if (SHOW_FPS) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(this.canvasWidth / 2 - 210, this.canvasHeight - 34, 420, 24);
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = this.currentFPS >= 50 ? '#7CFC8A' : this.currentFPS >= 30 ? '#FFD24D' : '#FF6B6B';
      const info = `${this.currentFPS} FPS  worst ${this.shownWorstGap || 0}ms  long ${this.shownLongFrames || 0}  ${this.canvasWidth}×${this.canvasHeight} @${(window.devicePixelRatio || 1).toFixed(1)}x`;
      ctx.fillText(info, this.canvasWidth / 2, this.canvasHeight - 22);
      ctx.textBaseline = 'alphabetic';
    }
  }

  // Top bar shared by menu screens: player chip left, voice + language right
  renderTopBar({ showPlayer = true } = {}) {
    const ctx = this.ctx;
    const W = this.canvasWidth;

    if (showPlayer) {
      const name = this.profile.getName() || '?';
      ctx.font = font(18, '600');
      const nameWidth = ctx.measureText(name).width;
      const chipW = 64 + nameWidth + 54;
      const chipH = 44;
      const chipX = 16;
      const chipY = 14;
      drawCard(ctx, chipX, chipY, chipW, chipH, { radius: 22, shadow: false, fill: 'rgba(255,255,255,0.85)' });
      this.drawAvatarAt(chipX + 28, chipY + chipH / 2, 13);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.ink;
      ctx.font = font(18, '600');
      ctx.fillText(name, chipX + 58, chipY + chipH / 2);
      ctx.fillStyle = COLORS.inkSoft;
      ctx.font = emojiFont(18);
      ctx.fillText('✏️', chipX + chipW - 34, chipY + chipH / 2 + 1);
      ctx.textBaseline = 'alphabetic';
      this.hitAreas.add({ x: chipX, y: chipY, width: chipW, height: chipH }, () => {
        this.state.openProfile();
        this.profileUI.show({ allowBack: true });
      });
    }

    // Voice toggle + flags on a translucent tray
    const iconY = 36;
    const langs = getAvailableLanguages();
    const trayW = (langs.length + 1) * 50 + 6;
    drawCard(ctx, W - 16 - trayW, 14, trayW, 44, { radius: 22, shadow: false, fill: 'rgba(255,255,255,0.85)' });
    let x = W - 16 - 28;
    for (let i = langs.length - 1; i >= 0; i--) {
      const lang = langs[i];
      const selected = getLanguage() === lang.code;
      ctx.globalAlpha = selected ? 1 : 0.5;
      ctx.font = emojiFont(26);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lang.flag, x, iconY);
      ctx.globalAlpha = 1;
      if (selected) {
        ctx.strokeStyle = COLORS.primary;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 12, iconY + 17);
        ctx.lineTo(x + 12, iconY + 17);
        ctx.stroke();
      }
      this.hitAreas.add({ x: x - 22, y: iconY - 22, width: 44, height: 48 }, () => {
        setLanguage(lang.code);
        this.voice.setLanguage(lang.code);
        this.translateStaticDom();
      });
      x -= 50;
    }
    ctx.globalAlpha = this.voice.isEnabled() ? 1 : 0.5;
    ctx.fillText(this.voice.isEnabled() ? '🔊' : '🔇', x, iconY);
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
    this.hitAreas.add({ x: x - 22, y: iconY - 22, width: 44, height: 48 }, () => this.voice.toggle());
  }

  renderMenu() {
    const ctx = this.ctx;
    const W = this.canvasWidth;
    const cx = W / 2;

    this.renderTopBar();
    this.renderWeatherChip();

    drawTitle(ctx, t('title'), cx, 78, 54);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = font(18, '600');
    ctx.fillText(t('subtitle'), cx, 106);
    // Secret: tap the title 7 times quickly to open the character gallery
    this.hitAreas.add({ x: cx - 180, y: 30, width: 360, height: 60 }, () => {
      const now = performance.now();
      if (now - this.secretTapTime > 2500) this.secretTaps = 0;
      this.secretTapTime = now;
      this.secretTaps++;
      if (this.secretTaps >= 7) {
        this.secretTaps = 0;
        this.openGallery();
      }
    });

    if (this.benchResults) {
      this.renderBenchResults();
    } else if (this.menuView === 'practice') {
      this.renderPracticePanel(cx);
    } else {
      this.renderDailyPanel(cx);
    }

    // First time only: explain why we'd like the location before the browser asks
    const canAsk = this.state.current() === STATES.MENU && this.profile.hasName() && !this.profileUI.isVisible();
    if (canAsk && this.locationChoice === null && navigator.geolocation && !this.showLocationCard && !this.locationCardShownOnce) {
      this.locationCardShownOnce = true;
      this.showLocationCard = true;
    }
    if (this.showLocationCard && canAsk) this.renderLocationCard();
  }

  renderBenchResults() {
    const ctx = this.ctx;
    const cx = this.canvasWidth / 2;
    const r = this.benchResults;
    const cardW = Math.min(620, this.canvasWidth - 40);
    const cardX = cx - cardW / 2;
    const cardY = 120;
    const rowH = 26;
    const cardH = 90 + r.rows.length * rowH;
    drawCard(ctx, cardX, cardY, cardW, cardH, { radius: 20 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Render benchmark', cardX + 20, cardY + 22);
    ctx.fillStyle = COLORS.inkSoft;
    ctx.font = '11px monospace';
    ctx.fillText(r.device, cardX + 20, cardY + 40);
    ctx.fillText(r.ua, cardX + 20, cardY + 54);
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = COLORS.ink;
    const y0 = cardY + 78;
    ctx.fillText('config', cardX + 20, y0);
    ctx.textAlign = 'right';
    ctx.fillText('fps', cardX + cardW - 200, y0);
    ctx.fillText('avg ms', cardX + cardW - 140, y0);
    ctx.fillText('p95', cardX + cardW - 80, y0);
    ctx.fillText('worst', cardX + cardW - 20, y0);
    ctx.font = '13px monospace';
    r.rows.forEach((row, i) => {
      const y = y0 + (i + 1) * rowH;
      ctx.fillStyle = row.fps >= 50 ? COLORS.successDark : row.fps >= 30 ? '#B8860B' : COLORS.danger;
      ctx.textAlign = 'left';
      ctx.fillText(row.name, cardX + 20, y);
      ctx.textAlign = 'right';
      ctx.fillText(String(row.fps), cardX + cardW - 200, y);
      ctx.fillText(String(row.avg), cardX + cardW - 140, y);
      ctx.fillText(String(row.p95), cardX + cardW - 80, y);
      ctx.fillText(String(row.worst), cardX + cardW - 20, y);
    });
    ctx.textBaseline = 'alphabetic';
    const btn = drawButton(ctx, cx - 80, cardY + cardH + 14, 160, 44, t('back'), { color: COLORS.secondary, dark: COLORS.secondaryDark, fontSize: 16 });
    this.hitAreas.add(btn, () => { this.benchResults = null; });
  }

  renderDailyPanel(cx) {
    const ctx = this.ctx;
    const table = getDailyTable();
    const today = new Date();
    const dateLabel = today.toLocaleDateString(getLanguage() === 'sv' ? 'sv-SE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    const cardW = Math.min(540, this.canvasWidth - 40);
    const cardH = 328;
    const cardX = cx - cardW / 2;
    const cardY = 126;
    drawCard(ctx, cardX, cardY, cardW, cardH, { radius: 24 });

    // Header ribbon
    ctx.fillStyle = COLORS.secondary;
    roundRect(ctx, cardX, cardY, cardW, 54, 24);
    ctx.fill();
    ctx.fillStyle = COLORS.secondary;
    ctx.fillRect(cardX, cardY + 30, cardW, 24);
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'center';
    ctx.font = font(22, '700');
    ctx.fillText(`${t('dailyChallenge')}  •  ${dateLabel}`, cx, cardY + 35);

    // Big table badge
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(cx, cardY + 132, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.goldDark;
    ctx.beginPath();
    ctx.arc(cx, cardY + 136, 58, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    ctx.arc(cx, cardY + 130, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(46, '700');
    ctx.textBaseline = 'middle';
    ctx.fillText(`${table}×`, cx, cardY + 132);
    ctx.textBaseline = 'alphabetic';

    // Table mascot: the animal for this table, with its memory hook
    const mascot = getTableMascot(table);
    const lang = getLanguage() === 'sv' ? 'sv' : 'en';
    this.drawAvatarAt(cx + 118, cardY + 122, 30, mascot.avatarId);
    ctx.fillStyle = COLORS.secondary;
    ctx.font = font(13, '700');
    ctx.textAlign = 'center';
    ctx.fillText(mascot.hook[lang], cx + 118, cardY + 172);

    ctx.fillStyle = COLORS.inkSoft;
    ctx.font = font(16, '600');
    ctx.fillText(t('weeklyHint'), cx, cardY + 218);
    ctx.fillStyle = COLORS.secondary;
    ctx.font = font(13, '700');
    ctx.fillText(`⏳ ${t('newTableIn')} ${formatTimeUntilNextDay()}`, cx, cardY + 238);

    // Play button
    const btnW = 240;
    const btnH = 58;
    const rect = drawButton(ctx, cx - btnW / 2, cardY + cardH - btnH - 20, btnW, btnH,
      `▶  ${t('play')}`, { fontSize: 26 });
    this.hitAreas.add(rect, () => this.startDaily());

    // Secondary buttons
    const secY = cardY + cardH + 22;
    const secW = Math.min(250, (cardW - 20) / 2);
    const secH = 52;
    const gap = 20;
    const r1 = drawButton(ctx, cx - secW - gap / 2, secY, secW, secH, t('practice'),
      { color: COLORS.secondary, dark: COLORS.secondaryDark, fontSize: 20, icon: '🎯' });
    this.hitAreas.add(r1, () => { this.menuView = 'practice'; });
    const r2 = drawButton(ctx, cx + gap / 2, secY, secW, secH, t('highscores'),
      { color: COLORS.success, dark: COLORS.successDark, fontSize: 20, icon: '🏆' });
    this.hitAreas.add(r2, () => { this.lastRank = null; this.state.openHighscores(); });

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = font(14, '600');
    ctx.textAlign = 'center';
    ctx.fillText(this.isMobile ? t('tapToFlap') : t('spaceToFlap'), cx, secY + secH + 30);
  }

  renderPracticePanel(cx) {
    const ctx = this.ctx;
    const cardW = Math.min(560, this.canvasWidth - 40);
    const cardX = cx - cardW / 2;
    const cardY = 124;
    const cardH = 372;
    drawCard(ctx, cardX, cardY, cardW, cardH, { radius: 24 });

    ctx.fillStyle = COLORS.ink;
    ctx.textAlign = 'center';
    ctx.font = font(22, '700');
    ctx.fillText(`🎯 ${t('practice')}`, cx, cardY + 34);
    ctx.fillStyle = COLORS.inkSoft;
    ctx.font = font(14, '600');
    ctx.fillText(t('selectTable'), cx, cardY + 58);

    // Table grid 6 x 2
    const cols = 6;
    const cellW = Math.min(76, (cardW - 40 - (cols - 1) * 8) / cols);
    const cellH = 56;
    const gap = 8;
    const gridW = cols * cellW + (cols - 1) * gap;
    const gridX = cx - gridW / 2;
    const gridY = cardY + 72;

    const tableCount = MAX_TABLE - MIN_TABLE + 1;
    for (let i = 0; i < tableCount; i++) {
      const table = MIN_TABLE + i;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gridX + col * (cellW + gap);
      const y = gridY + row * (cellH + gap);
      const best = this.progress.getBestSpeed(table);
      const selected = table === this.selectedTable;

      ctx.fillStyle = selected ? COLORS.primaryDark : COLORS.mutedBorder;
      roundRect(ctx, x, y + 3, cellW, cellH, 14);
      ctx.fill();
      ctx.fillStyle = selected ? COLORS.primary : (best > 0 ? '#E3F5E8' : COLORS.muted);
      roundRect(ctx, x, y, cellW, cellH, 14);
      ctx.fill();

      this.drawAvatarAt(x + cellW - 16, y + 15, 8, getTableMascot(table).avatarId);
      ctx.fillStyle = selected ? '#FFF' : COLORS.ink;
      ctx.font = font(22, '700');
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(`${table}×`, x + cellW / 2 - 6, y + (best > 0 ? 22 : cellH / 2));
      if (best > 0) {
        ctx.fillStyle = selected ? 'rgba(255,255,255,0.9)' : COLORS.inkSoft;
        ctx.font = font(11, '600');
        ctx.fillText(`${t('best')} ${best}`, x + cellW / 2, y + 43);
      }
      ctx.textBaseline = 'alphabetic';
      this.hitAreas.add({ x, y, width: cellW, height: cellH }, () => { this.selectedTable = table; });
    }

    // Speed stepper
    const speedY = gridY + 2 * cellH + gap + 24;
    ctx.fillStyle = COLORS.inkSoft;
    ctx.font = font(14, '600');
    ctx.textAlign = 'center';
    ctx.fillText(t('speedLevel'), cx, speedY);

    const stepBtnW = 52;
    const stepBtnH = 46;
    const stepY = speedY + 12;
    const minus = drawButton(ctx, cx - 110, stepY, stepBtnW, stepBtnH, '−',
      { color: COLORS.secondary, dark: COLORS.secondaryDark, fontSize: 28 });
    this.hitAreas.add(minus, () => { this.selectedSpeed = Math.max(1, this.selectedSpeed - 1); });
    const plus = drawButton(ctx, cx + 110 - stepBtnW, stepY, stepBtnW, stepBtnH, '+',
      { color: COLORS.secondary, dark: COLORS.secondaryDark, fontSize: 28 });
    this.hitAreas.add(plus, () => { this.selectedSpeed = Math.min(99, this.selectedSpeed + 1); });

    ctx.fillStyle = COLORS.ink;
    ctx.font = font(36, '700');
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.selectedSpeed), cx, stepY + stepBtnH / 2);
    ctx.textBaseline = 'alphabetic';

    // Start + back
    const btnY = cardY + cardH - 58 - 18;
    const start = drawButton(ctx, cx - 40, btnY, Math.min(230, cardW / 2 - 10), 58, t('startGame'), { fontSize: 24 });
    this.hitAreas.add(start, () => this.startPractice());
    const back = drawButton(ctx, cx - 40 - 16 - 130, btnY, 130, 58, t('back'),
      { color: COLORS.muted, dark: COLORS.mutedBorder, textColor: COLORS.inkSoft, fontSize: 20 });
    this.hitAreas.add(back, () => { this.menuView = 'daily'; });
  }

  renderGame() {
    const ctx = this.ctx;
    const W = this.canvasWidth;

    this.pipes.forEach(pipe => pipe.render(ctx));
    this.bird.render(ctx);

    // Question pill (top center) - cached per problem text
    if (this.currentProblem) {
      const text = this.currentProblem.text;
      ctx.font = font(30, '700');
      if (this.measuredProblemText !== text) {
        this.measuredProblemText = text;
        this.measuredProblemWidth = ctx.measureText(text).width;
      }
      const pillW = Math.ceil(this.measuredProblemWidth + 56);
      const pillH = 56;
      const pad = 6;
      const pill = this.cachedPanel('pill', text, pillW, pillH + pad, (c, w) => {
        c.fillStyle = 'rgba(31, 42, 68, 0.25)';
        roundRect(c, 0, 4, w, pillH, 28);
        c.fill();
        c.fillStyle = 'rgba(31, 42, 68, 0.92)';
        roundRect(c, 0, 0, w, pillH, 28);
        c.fill();
        c.fillStyle = COLORS.gold;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = font(30, '700');
        c.fillText(text, w / 2, pillH / 2 + 1);
      });
      this.blitPanel(pill, Math.round(W / 2 - pillW / 2), 14);
    }

    const isDaily = this.run.mode === MODES.DAILY;

    // Left HUD: player + score (avatar drawn live on top for its idle animation)
    const hudX = 14;
    const hudY = 14;
    const hudW = 190;
    const hudH = 84;
    const mainValue = isDaily ? String(this.scoring.score) : `${this.scoring.streak}/10`;
    const leftKey = `${this.profile.getName()}|${isDaily}|${mainValue}|${getLanguage()}`;
    const left = this.cachedPanel('hudLeft', leftKey, hudW, hudH, (c) => {
      c.fillStyle = 'rgba(31, 42, 68, 0.75)';
      roundRect(c, 0, 0, hudW, hudH, 18);
      c.fill();
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = '#FFF';
      c.font = font(17, '600');
      c.fillText(this.profile.getName(), 58, 26);
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.font = font(13, '600');
      c.fillText(isDaily ? t('score') : t('streak'), 12, 58);
      c.fillStyle = COLORS.gold;
      c.font = font(26, '700');
      c.fillText(mainValue, 72, 58);
    });
    this.blitPanel(left, hudX, hudY);
    this.drawAvatarAt(hudX + 28, hudY + 28, 14);

    // Right HUD: table, speed, lives
    const rW = 170;
    const rX = W - rW - 14;
    const rY = 14;
    const rH = 84;
    const rightKey = `${this.run.table}|${this.run.speed}|${this.scoring.lives}|${isDaily}|${getLanguage()}`;
    const right = this.cachedPanel('hudRight', rightKey, rW, rH, (c) => {
      c.fillStyle = 'rgba(31, 42, 68, 0.75)';
      roundRect(c, 0, 0, rW, rH, 18);
      c.fill();
      c.textBaseline = 'middle';
      c.textAlign = 'left';
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.font = font(13, '600');
      c.fillText(t('table'), 14, 22);
      c.fillText(t('speed'), 14, 44);
      c.textAlign = 'right';
      c.fillStyle = '#FFF';
      c.font = font(17, '700');
      c.fillText(`${this.run.table}×`, rW - 14, 22);
      c.fillStyle = isDaily ? COLORS.gold : '#FFF';
      c.fillText(String(this.run.speed), rW - 14, 44);
      for (let i = 0; i < 3; i++) {
        const filled = i < this.scoring.lives;
        drawHeart(c, rW - 22 - (2 - i) * 24, 66, 18, filled ? '#EF5A5A' : 'rgba(255,255,255,0.25)');
      }
    });
    this.blitPanel(right, rX, rY);
    ctx.textBaseline = 'alphabetic';

    // Hint before the first flap
    if (!this.hasFlapped) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = font(20, '600');
      ctx.textAlign = 'center';
      const hint = this.isMobile ? t('tapToFlap') : t('spaceToFlap');
      const hw = ctx.measureText(hint).width + 40;
      ctx.fillStyle = 'rgba(31, 42, 68, 0.6)';
      roundRect(ctx, W / 2 - hw / 2, this.canvasHeight - 100, hw, 44, 22);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(hint, W / 2, this.canvasHeight - 78);
      ctx.textBaseline = 'alphabetic';
    }
  }

  renderGameOver() {
    const ctx = this.ctx;
    const W = this.canvasWidth;
    const cx = W / 2;

    ctx.fillStyle = 'rgba(31, 42, 68, 0.55)';
    ctx.fillRect(0, 0, W, this.canvasHeight);

    const cardW = Math.min(520, W - 40);
    const cardH = 430;
    const cardX = cx - cardW / 2;
    const cardY = 36;
    drawCard(ctx, cardX, cardY, cardW, cardH, { radius: 26, fill: this.showMasteryMessage ? '#FFF6D6' : COLORS.card });

    ctx.textAlign = 'center';
    if (this.showMasteryMessage) {
      ctx.font = emojiFont(64);
      ctx.fillText('⭐', cx, cardY + 78);
    } else {
      this.drawAvatarAt(cx, cardY + 62, 32);
    }

    if (this.showMasteryMessage) {
      ctx.fillStyle = COLORS.goldDark;
      ctx.font = font(40, '700');
      ctx.fillText(t('mastered'), cx, cardY + 132);
      ctx.fillStyle = COLORS.inkSoft;
      ctx.font = font(20, '600');
      ctx.fillText(`${this.run.table}× ${t('tableAt')}  •  ${t('speedLevelAt')} ${this.run.speed}`, cx, cardY + 170);
      ctx.fillStyle = COLORS.success;
      ctx.font = font(18, '600');
      ctx.fillText(t('correctInRow'), cx, cardY + 204);
    } else {
      ctx.fillStyle = COLORS.danger;
      ctx.font = font(38, '700');
      ctx.fillText(t('gameOver'), cx, cardY + 128);

      ctx.fillStyle = COLORS.inkSoft;
      ctx.font = font(16, '600');
      ctx.fillText(this.profile.getName(), cx, cardY + 154);

      // Stat columns
      const stats = [
        [t('finalScore'), String(this.scoring.score), COLORS.primary],
        [t('topSpeed'), String(this.run.maxSpeed), COLORS.secondary],
        [t('table'), `${this.run.table}×`, COLORS.success]
      ];
      const colW = cardW / stats.length;
      stats.forEach(([label, value, color], i) => {
        const x = cardX + colW * i + colW / 2;
        ctx.fillStyle = COLORS.inkSoft;
        ctx.font = font(14, '600');
        ctx.textAlign = 'center';
        ctx.fillText(label, x, cardY + 196);
        ctx.fillStyle = color;
        ctx.font = font(40, '700');
        ctx.fillText(value, x, cardY + 240);
        if (i === 2) this.drawAvatarAt(x + 46, cardY + 226, 14, getTableMascot(this.run.table).avatarId);
      });

      if (this.unlockedThisRun) {
        const name = Avatars.getAvatar(this.unlockedThisRun).name;
        const bx = cardX + cardW - 60;
        const badge = { x: bx - 56, y: cardY + 30, width: 112, height: 96 };
        const isCurrent = this.unlockedThisRun === this.profile.getAvatarId();
        ctx.fillStyle = isCurrent ? '#E3F5E8' : COLORS.muted;
        roundRect(ctx, badge.x, badge.y, badge.width, badge.height, 18);
        ctx.fill();
        this.drawAvatarAt(bx, cardY + 62, 18, this.unlockedThisRun);
        ctx.fillStyle = COLORS.success;
        ctx.font = font(11, '700');
        ctx.textAlign = 'center';
        ctx.fillText(isCurrent ? t('nowPlayingAs') : t('newCharacter'), bx, cardY + 98);
        ctx.fillStyle = COLORS.inkSoft;
        ctx.font = font(11, '600');
        ctx.fillText(name, bx, cardY + 114);
        if (!isCurrent) this.addSelectableCharacter(badge, this.unlockedThisRun);
      }

      if (this.lastRank || this.isPersonalBest) {
        const label = this.isPersonalBest
          ? `🎉 ${t('newPersonalBest')}${this.lastRank ? `  ${t('rank')} #${this.lastRank}` : ''}`
          : `🏆 ${t('newHighscore')}  ${t('rank')} #${this.lastRank}`;
        ctx.font = font(18, '700');
        const badgeW = Math.ceil(ctx.measureText(label).width + 40);
        ctx.fillStyle = COLORS.gold;
        roundRect(ctx, cx - badgeW / 2, cardY + 262, badgeW, 40, 20);
        ctx.fill();
        ctx.fillStyle = COLORS.ink;
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cardY + 282);
        ctx.textBaseline = 'alphabetic';
      }
      if (this.globalRank) {
        ctx.fillStyle = COLORS.secondary;
        ctx.font = font(14, '700');
        ctx.fillText(`🌍 ${t('globalRank')} #${this.globalRank}`, cx, cardY + 322);
      }
    }

    // Buttons
    const btnY = cardY + cardH - 58 - 20;
    const btnH = 58;
    const total = cardW - 40;
    const wPlay = Math.round(total * 0.42);
    const wHigh = Math.round(total * 0.33);
    const wMenu = total - wPlay - wHigh - 20;
    let bx = cardX + 20;
    const again = drawButton(ctx, bx, btnY, wPlay, btnH, t('playAgain'), { fontSize: 21, icon: '🔁' });
    this.hitAreas.add(again, () => {
      this.state.returnToMenu();
      if (this.run.mode === MODES.DAILY) this.startDaily();
      else this.startPractice();
    });
    bx += wPlay + 10;
    const high = drawButton(ctx, bx, btnY, wHigh, btnH, t('highscores'),
      { color: COLORS.success, dark: COLORS.successDark, fontSize: 19, icon: '🏆' });
    this.hitAreas.add(high, () => this.state.openHighscores());
    bx += wHigh + 10;
    const menu = drawButton(ctx, bx, btnY, wMenu, btnH, t('menu'),
      { color: COLORS.muted, dark: COLORS.mutedBorder, textColor: COLORS.inkSoft, fontSize: 19 });
    this.hitAreas.add(menu, () => this.state.returnToMenu());

    // Confetti sits above the card so the celebration reads as one moment
    this.confetti.render(ctx);
  }

  renderHighscores() {
    const ctx = this.ctx;
    const W = this.canvasWidth;
    const cx = W / 2;

    this.renderTopBar({ showPlayer: false });
    drawTitle(ctx, `🏆 ${t('highscores')}`, cx, 62, 40);

    const cardW = Math.min(680, W - 40);
    const cardX = cx - cardW / 2;
    const cardY = 84;
    const cardH = 430;
    drawCard(ctx, cardX, cardY, cardW, cardH, { radius: 24 });

    // Tabs: this device / everyone
    const tabW = 150;
    const tabH = 34;
    const tabY = cardY + 12;
    const tabs = [['local', t('localTab'), '📱'], ['global', t('globalTab'), '🌍']];
    tabs.forEach(([id, label, icon], i) => {
      const x = cx - tabW - 6 + i * (tabW + 12);
      const active = this.highscoreTab === id;
      ctx.fillStyle = active ? COLORS.secondary : COLORS.muted;
      roundRect(ctx, x, tabY, tabW, tabH, 17);
      ctx.fill();
      ctx.fillStyle = active ? '#FFF' : COLORS.inkSoft;
      ctx.font = font(15, '700');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${icon} ${label}`, x + tabW / 2, tabY + tabH / 2);
      this.hitAreas.add({ x, y: tabY, width: tabW, height: tabH }, () => {
        this.highscoreTab = id;
        if (id === 'global') this.refreshGlobal();
      });
    });
    ctx.textBaseline = 'alphabetic';

    // Table filter: ◀ 6× ▶ with "all tables" at the end of the cycle
    const filterY = cardY + 54;
    const options = [null];
    for (let tbl = MIN_TABLE; tbl <= MAX_TABLE; tbl++) options.push(tbl);
    const step = (dir) => {
      const i = options.indexOf(this.highscoreTable);
      this.highscoreTable = options[(i + dir + options.length) % options.length];
      this.global = { status: 'idle', entries: [], fetchedAt: 0 };
    };
    const arrowW = 34;
    const arrowH = 28;
    const left = drawButton(ctx, cx - 120, filterY, arrowW, arrowH, '◀', { color: COLORS.muted, dark: COLORS.mutedBorder, textColor: COLORS.inkSoft, fontSize: 14 });
    this.hitAreas.add(left, () => step(-1));
    const right = drawButton(ctx, cx + 120 - arrowW, filterY, arrowW, arrowH, '▶', { color: COLORS.muted, dark: COLORS.mutedBorder, textColor: COLORS.inkSoft, fontSize: 14 });
    this.hitAreas.add(right, () => step(1));
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(15, '700');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const todayTable = getDailyTable();
    const filterLabel = this.highscoreTable === null ? t('allTables')
      : `${this.highscoreTable}×${this.highscoreTable === todayTable ? `  (${t('todayShort')})` : ''}`;
    ctx.fillText(filterLabel, cx, filterY + arrowH / 2);
    ctx.textBaseline = 'alphabetic';

    const isGlobal = this.highscoreTab === 'global';
    if (isGlobal) this.refreshGlobal();
    const entries = isGlobal
      ? this.global.entries.map(e => ({ ...e, maxSpeed: e.speed }))
      : this.highscores.listForTable(this.highscoreTable);
    const rowH = 31;
    const listY = cardY + 96;

    if (entries.length === 0) {
      ctx.fillStyle = COLORS.inkSoft;
      ctx.font = font(18, '600');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const message = !isGlobal ? t('noScores')
        : this.global.status === 'loading' ? t('globalLoading')
        : this.global.status === 'error' ? t('globalOffline')
        : t('noScores');
      ctx.fillText(message, cx, cardY + cardH / 2 - 10);
      ctx.textBaseline = 'alphabetic';
    }

    // Column layout
    const colRank = cardX + 34;
    const colAvatar = cardX + 74;
    const colName = cardX + 106;
    const colDate = cardX + cardW - 190;
    const colScore = cardX + cardW - 150;
    const colTable = cardX + cardW - 92;
    const colSpeed = cardX + cardW - 34;
    const locale = getLanguage() === 'sv' ? 'sv-SE' : 'en-GB';

    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.inkSoft;
    ctx.font = font(12, '600');
    ctx.textAlign = 'right';
    ctx.fillText(t('finalScore'), colScore, listY);
    ctx.fillText(t('table'), colTable, listY);
    ctx.fillText(t('speed'), colSpeed, listY);

    entries.forEach((e, i) => {
      const y = listY + 18 + i * rowH + rowH / 2;
      const isNew = isGlobal
        ? String(e.name).toLowerCase() === this.profile.getName().toLowerCase()
        : this.lastRank === i + 1;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

      if (isNew || i % 2 === 0) {
        ctx.fillStyle = isNew ? 'rgba(255, 201, 60, 0.35)' : 'rgba(31, 42, 68, 0.04)';
        roundRect(ctx, cardX + 12, y - rowH / 2 + 2, cardW - 24, rowH - 4, 10);
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.ink; // emoji keep the alpha of fillStyle, so reset it after the row tint
      if (medal) {
        ctx.font = emojiFont(20);
        ctx.fillText(medal, colRank, y);
      } else {
        ctx.fillStyle = COLORS.inkSoft;
        ctx.font = font(16, '700');
        ctx.fillText(String(i + 1), colRank, y);
      }
      this.drawAvatarAt(colAvatar, y, 11, e.avatar);

      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.ink;
      ctx.font = font(18, '600');
      ctx.fillText(e.name, colName, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.inkSoft;
      ctx.font = font(12, '600');
      ctx.fillText(formatEntryDate(e.date, locale), colDate, y);

      ctx.fillStyle = COLORS.primary;
      ctx.font = font(20, '700');
      ctx.fillText(String(e.score), colScore, y);
      ctx.fillStyle = COLORS.inkSoft;
      ctx.font = font(16, '600');
      ctx.fillText(`${e.table}×`, colTable, y);
      ctx.fillText(String(e.maxSpeed), colSpeed, y);
    });
    ctx.textBaseline = 'alphabetic';

    const back = drawButton(ctx, cx - 90, cardY + cardH + 8, 180, 48, t('back'),
      { color: COLORS.secondary, dark: COLORS.secondaryDark, fontSize: 20 });
    this.hitAreas.add(back, () => this.state.returnToMenu());
  }
  renderToast() {
    if (!this.toast) return;
    // Keep the play field clean; the toast waits until the run is over
    if (this.state.current() === STATES.PLAYING) {
      this.toast.until = Math.max(this.toast.until, performance.now() + this.toast.duration);
      return;
    }
    const now = performance.now();
    if (now > this.toast.until) { this.toast = null; return; }
    const ctx = this.ctx;
    const W = this.canvasWidth;
    const remaining = this.toast.until - now;
    const slide = Math.min(1, remaining / 400, (this.toast.duration - remaining) / 400);
    const name = Avatars.getAvatar(this.toast.avatarId).name;
    const selectable = this.toast.selectable && this.toast.avatarId !== this.profile.getAvatarId();
    const toastW = 340;
    const toastH = selectable ? 80 : 64;
    const x = W / 2 - toastW / 2;
    const y = this.canvasHeight - 70 - (toastH - 64) - (1 - slide) * 110;
    const rect = { x, y, width: toastW, height: toastH };
    drawCard(ctx, x, y, toastW, toastH, { radius: 20, fill: 'rgba(31, 42, 68, 0.92)' });
    this.drawAvatarAt(x + 36, y + 32, 18, this.toast.avatarId);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.gold;
    ctx.font = font(16, '700');
    ctx.fillText(this.toast.title, x + 70, y + 22);
    ctx.fillStyle = '#FFF';
    ctx.font = font(17, '600');
    ctx.fillText(name, x + 70, y + 44);
    if (selectable) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = font(12, '600');
      ctx.fillText(`👆 ${t('tapToUse')}`, x + 70, y + 65);
      this.addSelectableCharacter(rect, this.toast.avatarId);
    }
    ctx.textBaseline = 'alphabetic';
  }

  drawPadlock(ctx, x, y, size, color) {
    const w = size;
    const h = size * 0.8;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, size * 0.18);
    ctx.beginPath();
    ctx.arc(x, y - h / 2, w * 0.32, Math.PI, 0);
    ctx.stroke();
    roundRect(ctx, x - w / 2, y - h / 2 + 2, w, h, size * 0.2);
    ctx.fill();
  }

  renderGallery() {
    const ctx = this.ctx;
    const W = this.canvasWidth;
    const cx = W / 2;
    const all = Avatars.AVATARS;
    const unlockedCount = this.unlocks.unlockedIds().length;

    this.renderTopBar({ showPlayer: false });
    drawTitle(ctx, t('gallery'), cx, 52, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = font(16, '600');
    ctx.textAlign = 'center';
    ctx.fillText(`${unlockedCount} / ${all.length} ${t('unlockedOf')}`, cx, 78);

    const cardW = Math.min(760, W - 40);
    const cardX = cx - cardW / 2;
    const cardY = 92;
    const cardH = 400;
    drawCard(ctx, cardX, cardY, cardW, cardH, { radius: 24 });

    const cell = 66;
    const gap = 6;
    const cols = Math.max(4, Math.floor((cardW - 32) / (cell + gap)));
    const rows = 4;
    const perPage = cols * rows;
    const pages = Math.max(1, Math.ceil(all.length / perPage));
    this.galleryPage = Math.min(this.galleryPage, pages - 1);
    const gridW = cols * cell + (cols - 1) * gap;
    const gridX = cx - gridW / 2;
    const gridY = cardY + 16;
    const currentId = this.profile.getAvatarId();

    const start = this.galleryPage * perPage;
    for (let i = start; i < Math.min(all.length, start + perPage); i++) {
      const a = all[i];
      const k = i - start;
      const x = gridX + (k % cols) * (cell + gap);
      const y = gridY + Math.floor(k / cols) * (cell + gap);
      const unlocked = this.unlocks.isUnlocked(a.id);
      const selected = a.id === currentId;
      const rarity = a.rarity || 'common';

      ctx.fillStyle = selected ? COLORS.primary : unlocked ? (rarity === 'epic' ? '#FFF1C2' : rarity === 'rare' ? '#E4ECFF' : COLORS.muted) : '#E6E8EF';
      roundRect(ctx, x, y, cell, cell, 14);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = COLORS.primaryDark;
        ctx.lineWidth = 3;
        roundRect(ctx, x, y, cell, cell, 14);
        ctx.stroke();
      }

      if (unlocked) {
        this.drawAvatarAt(x + cell / 2, y + cell / 2 + 2, 15, a.id);
        this.hitAreas.add({ x, y, width: cell, height: cell }, () => {
          this.profile.setAvatar(a.id);
          this.applyAvatar();
        });
      } else {
        this.drawPadlock(ctx, x + cell / 2, y + cell / 2 + 4, 18, '#B7BDCC');
      }
    }

    // Selected character name + hints
    const sel = Avatars.getAvatar(currentId);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ink;
    ctx.font = font(16, '700');
    ctx.fillText(`${t('selectedCharacter')}: ${sel.name}`, cx, cardY + cardH - 46);
    ctx.fillStyle = COLORS.inkSoft;
    ctx.font = font(12, '600');
    ctx.fillText(`${t('weeklyDropHint')}  •  ${t('highscoreUnlockHint')}`, cx, cardY + cardH - 22);

    // Pager + back
    const btnY = cardY + cardH + 14;
    const prev = drawButton(ctx, cx - 250, btnY, 110, 48, `◀ ${t('prev')}`,
      { color: COLORS.secondary, dark: COLORS.secondaryDark, fontSize: 16 });
    if (this.galleryPage > 0) this.hitAreas.add(prev, () => { this.galleryPage--; });
    ctx.fillStyle = '#FFF';
    ctx.font = font(16, '700');
    ctx.textBaseline = 'middle';
    ctx.fillText(`${t('page')} ${this.galleryPage + 1} / ${pages}`, cx, btnY + 24);
    ctx.textBaseline = 'alphabetic';
    const next = drawButton(ctx, cx + 140, btnY, 110, 48, `${t('next')} ▶`,
      { color: COLORS.secondary, dark: COLORS.secondaryDark, fontSize: 16 });
    if (this.galleryPage < pages - 1) this.hitAreas.add(next, () => { this.galleryPage++; });
    const back = drawButton(ctx, cx - 60, btnY, 120, 48, t('back'),
      { color: COLORS.muted, dark: COLORS.mutedBorder, textColor: COLORS.inkSoft, fontSize: 16 });
    this.hitAreas.add(back, () => this.state.returnToMenu());
  }
}

window.flappyMath = new Game();
