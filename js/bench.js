// On-device render benchmark (open the game with ?bench). Each configuration
// runs for a fixed time while frame gaps are measured; results are shown on
// the menu screen so a phone screenshot tells us where the time goes.

const CONFIG_MS = 1500;

function stats(gaps) {
  if (gaps.length === 0) return { fps: 0, avg: 0, p95: 0, worst: 0 };
  const sorted = [...gaps].sort((a, b) => a - b);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return {
    fps: Math.round(1000 / avg),
    avg: Math.round(avg * 10) / 10,
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
    worst: Math.round(sorted[sorted.length - 1])
  };
}

export async function runBenchmark(game) {
  const ctx = game.ctx;
  const original = {
    render: game.render,
    renderGame: game.renderGame,
    bgRender: game.background.render,
    update: game.update,
    canvasHeight: game.canvasHeight
  };

  // Start a run so there are pipes and a bird to draw, but freeze game logic
  game.startWeekly();
  game.update = () => {};
  game.benchRunning = true;

  const fullRenderGame = original.renderGame.bind(game);
  const configs = [
    { name: 'clear only', setup: () => {
      game.background.render = (c, w) => { c.fillStyle = '#A6DCFF'; c.fillRect(0, 0, w, game.canvasHeight); };
      game.renderGame = () => {};
    } },
    { name: 'sky blit only', setup: () => {
      game.background.render = (c, w) => { const sky = game.background._skyForBench(); if (sky) c.drawImage(sky, 0, 0); else { c.fillStyle = '#A6DCFF'; c.fillRect(0, 0, w, game.canvasHeight); } };
      game.renderGame = () => {};
    } },
    { name: 'background', setup: () => {
      game.background.render = original.bgRender;
      game.renderGame = () => {};
    } },
    { name: 'bg + pipes', setup: () => {
      game.renderGame = () => { game.pipes.forEach(p => p.render(ctx)); };
    } },
    { name: 'bg + pipes + bird', setup: () => {
      game.renderGame = () => { game.pipes.forEach(p => p.render(ctx)); game.bird.render(ctx); };
    } },
    { name: 'full game', setup: () => {
      game.renderGame = fullRenderGame;
    } },
    { name: 'full @ 400px tall', setup: () => {
      game.setResolutionHeight(400);
    } },
    { name: 'full @ 300px tall', setup: () => {
      game.setResolutionHeight(300);
    } }
  ];

  const results = [];
  for (const cfg of configs) {
    cfg.setup();
    const gaps = [];
    await new Promise(resolve => {
      let last = null;
      const t0 = performance.now();
      const tick = (t) => {
        if (last !== null) gaps.push(t - last);
        last = t;
        if (t - t0 < CONFIG_MS) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    results.push({ name: cfg.name, ...stats(gaps.slice(5)) });
  }

  // Restore
  game.setResolutionHeight(original.canvasHeight);
  game.background.render = original.bgRender;
  game.renderGame = original.renderGame;
  game.update = original.update;
  game.state.returnToMenu();
  game.benchRunning = false;
  game.benchResults = {
    device: `${window.innerWidth}×${window.innerHeight} css @${(window.devicePixelRatio || 1).toFixed(1)}x  canvas ${game.canvasWidth}×${game.canvasHeight}`,
    ua: navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90),
    rows: results
  };
  console.log('flappy-math bench', JSON.stringify(game.benchResults, null, 1));
  return game.benchResults;
}
