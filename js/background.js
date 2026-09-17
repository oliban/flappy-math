import { BASE_HEIGHT, GROUND_Y, GROUND_HEIGHT } from './constants.js';

// Layered parallax background. Everything static is pre-rendered once into
// offscreen canvases (sky, cloud sprites, hill strip, ground pattern) and
// blitted with drawImage each frame: mobile Safari rasterizes gradients and
// alpha-blended paths slowly, but copies bitmaps quickly.

const HILL_SPAN = 12 * 260;
const GROUND_TILE = 60;

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeCanvas(width, height) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(width));
  c.height = Math.max(1, Math.ceil(height));
  return c;
}

function drawCloudPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 26 * s, y - 12 * s, 28 * s, 0, Math.PI * 2);
  ctx.arc(x + 58 * s, y, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 30 * s, y + 8 * s, 24 * s, 0, Math.PI * 2);
  ctx.fill();
}

export function createBackground() {
  const rand = seededRandom(42);
  const clouds = [];
  for (let i = 0; i < 12; i++) {
    clouds.push({
      x: rand() * 2400,
      y: 40 + rand() * 260,
      scale: 0.6 + rand() * 0.9,
      layer: i % 3 // 0 = far/slow, 2 = near/fast
    });
  }
  const hills = [];
  for (let i = 0; i < 12; i++) {
    hills.push({ x: i * 260 + rand() * 80, radius: 140 + rand() * 120 });
  }

  let scroll = 0;
  let skyCanvas = null;
  let skyWidth = 0;
  let skyKey = '';

  // Weather (see js/weather.js). Drives palette, cloud cover, precipitation, wind.
  let weather = { condition: 'clear', isDay: true, windSpeed: 0 };
  const rain = [];   // { x, y, len, speed }
  const snow = [];   // { x, y, r, speed, phase }
  let flash = 0;     // lightning overlay alpha
  let nextFlashAt = 0;
  let frame = 0;
  const stars = [];
  for (let i = 0; i < 60; i++) stars.push({ x: rand() * 3000, y: rand() * 300, r: 0.6 + rand() * 1.4, tw: rand() * 6.28 });

  const SKIES = {
    clear:    { day: ['#5DB7F5', '#A6DCFF', '#E8F7FF'], night: ['#0B1A3A', '#1D3461', '#3A4F7A'] },
    clouds:   { day: ['#8AB4D6', '#BFD3E3', '#E3EBF1'], night: ['#111C33', '#233252', '#3E4A66'] },
    overcast: { day: ['#8A9BB0', '#B7C3D0', '#DDE3EA'], night: ['#141A26', '#242C3A', '#3A4252'] },
    fog:      { day: ['#B8C1CC', '#D3D9E0', '#E9ECF0'], night: ['#1E2430', '#333B48', '#4A5262'] },
    rain:     { day: ['#6B7D94', '#96A6B8', '#C4CDD7'], night: ['#0F1522', '#1F2838', '#333D4F'] },
    snow:     { day: ['#A9B8C8', '#CBD6E1', '#E9EEF3'], night: ['#1A2233', '#2E3A50', '#4A566B'] },
    thunder:  { day: ['#3F4A5C', '#5C6A80', '#8592A6'], night: ['#090D17', '#171E2E', '#2A3345'] }
  };

  const CLOUD_STYLE = {
    clear:    { count: 2,  color: '255,255,255', alpha: [0.35, 0.5, 0.6], scale: 0.7 },
    clouds:   { count: 12, color: '246,248,251', alpha: [0.85, 0.95, 1], scale: 1.45 },
    overcast: { count: 12, color: '225,230,238', alpha: [0.8, 0.9, 1] },
    fog:      { count: 8,  color: '235,238,242', alpha: [0.5, 0.6, 0.7] },
    rain:     { count: 12, color: '190,200,214', alpha: [0.85, 0.95, 1] },
    snow:     { count: 11, color: '230,236,243', alpha: [0.8, 0.9, 1] },
    thunder:  { count: 12, color: '120,132,152', alpha: [0.85, 0.95, 1] }
  };

  function windFactor() {
    return 1 + Math.min(40, weather.windSpeed || 0) / 30; // 0 km/h → 1x, 30 km/h → 2x
  }

  function seedPrecipitation(width) {
    rain.length = 0;
    snow.length = 0;
    if (weather.condition === 'rain' || weather.condition === 'thunder') {
      const n = weather.condition === 'thunder' ? 170 : 130;
      for (let i = 0; i < n; i++) rain.push({ x: Math.random() * (width + 200) - 100, y: Math.random() * BASE_HEIGHT, len: 10 + Math.random() * 14, speed: 9 + Math.random() * 5 });
    } else if (weather.condition === 'snow') {
      for (let i = 0; i < 90; i++) snow.push({ x: Math.random() * (width + 100) - 50, y: Math.random() * BASE_HEIGHT, r: 1.5 + Math.random() * 2.5, speed: 0.8 + Math.random() * 1.2, phase: Math.random() * 6.28 });
    }
  }
  let hillCanvas = null;
  let groundPattern = null;
  let groundPatternCtx = null;
  const cloudSprites = new Map(); // key -> { canvas, ox, oy }

  function ensureSky(width) {
    const key = `${width}|${weather.condition}|${weather.isDay ? 'd' : 'n'}`;
    if (skyCanvas && skyKey === key) return;
    skyKey = key;
    skyWidth = width;
    skyCanvas = makeCanvas(width, BASE_HEIGHT);
    const c = skyCanvas.getContext('2d');
    const palette = (SKIES[weather.condition] || SKIES.clear)[weather.isDay ? 'day' : 'night'];
    const g = c.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    g.addColorStop(0, palette[0]);
    g.addColorStop(0.55, palette[1]);
    g.addColorStop(1, palette[2]);
    c.fillStyle = g;
    c.fillRect(0, 0, width, BASE_HEIGHT);

    const bodyX = width * 0.78;
    const bodyY = 150;
    const showSun = weather.isDay && weather.condition === 'clear';
    if (weather.isDay && weather.condition === 'clouds') {
      // Sun hidden behind the cloud deck: a soft glow only
      c.fillStyle = 'rgba(255, 240, 190, 0.28)';
      c.beginPath(); c.arc(bodyX, bodyY, 80, 0, Math.PI * 2); c.fill();
    }
    const showMoon = !weather.isDay && weather.condition !== 'overcast' && weather.condition !== 'rain' && weather.condition !== 'thunder' && weather.condition !== 'fog';
    if (showSun) {
      c.fillStyle = 'rgba(255, 236, 150, 0.35)';
      c.beginPath(); c.arc(bodyX, bodyY, 70, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255, 236, 150, 0.9)';
      c.beginPath(); c.arc(bodyX, bodyY, 46, 0, Math.PI * 2); c.fill();
    }
    if (!weather.isDay) {
      // Stars (static, baked into the sky)
      for (const st of stars) {
        const x = (st.x % width);
        c.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * Math.abs(Math.sin(st.tw))})`;
        c.beginPath(); c.arc(x, st.y, st.r, 0, Math.PI * 2); c.fill();
      }
    }
    if (showMoon) {
      c.fillStyle = 'rgba(255, 250, 220, 0.25)';
      c.beginPath(); c.arc(bodyX, bodyY, 62, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#FFF6D5';
      c.beginPath(); c.arc(bodyX, bodyY, 40, 0, Math.PI * 2); c.fill();
      // crescent shadow
      c.fillStyle = palette[0];
      c.beginPath(); c.arc(bodyX - 18, bodyY - 8, 34, 0, Math.PI * 2); c.fill();
    }
  }

  function ensureHills() {
    if (hillCanvas) return;
    const height = BASE_HEIGHT - GROUND_Y + 300; // enough for the tallest hill
    const top = GROUND_Y - 300;
    hillCanvas = makeCanvas(HILL_SPAN, height);
    const c = hillCanvas.getContext('2d');
    c.translate(0, -top);
    // Both hill tones share one parallax speed so they can live in one strip.
    // Draw each hill three times (x-span, x, x+span) so wrapping is seamless.
    const drawRow = (color, offset, radiusScale, yScale) => {
      c.fillStyle = color;
      for (const h of hills) {
        for (const k of [-HILL_SPAN, 0, HILL_SPAN]) {
          const x = h.x + offset + k;
          c.beginPath();
          c.arc(x, GROUND_Y + h.radius * yScale, h.radius * radiusScale, Math.PI, 0);
          c.fill();
        }
      }
    };
    drawRow('#7FCB7A', 0, 1, 0.55);
    drawRow('#5FB85C', 130, 0.8, 0.7);
    hillCanvas.top = top;
  }

  function ensureGroundPattern(ctx) {
    if (groundPattern && groundPatternCtx === ctx) return;
    const tile = makeCanvas(GROUND_TILE, GROUND_HEIGHT);
    const c = tile.getContext('2d');
    c.fillStyle = '#4CA94F';
    c.fillRect(0, 0, GROUND_TILE, GROUND_HEIGHT);
    c.fillStyle = '#C98B4B';
    c.fillRect(0, 14, GROUND_TILE, GROUND_HEIGHT - 14);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    c.fillRect(0, 14, GROUND_TILE / 2, GROUND_HEIGHT - 14);
    groundPattern = ctx.createPattern(tile, 'repeat-x');
    groundPatternCtx = ctx;
  }

  function cloudSprite(cloud) {
    const style = CLOUD_STYLE[weather.condition] || CLOUD_STYLE.clear;
    const s = cloud.scale * (style.scale || 1);
    const key = `${cloud.layer}:${s.toFixed(2)}:${style.color}:${weather.isDay ? 'd' : 'n'}`;
    let sprite = cloudSprites.get(key);
    if (sprite) return sprite;
    const pad = 4;
    // Cloud path spans x: -22s..80s and y: -40s..32s around its anchor
    const w = 102 * s + pad * 2;
    const h = 72 * s + pad * 2;
    const canvas = makeCanvas(w, h);
    const c = canvas.getContext('2d');
    const alpha = style.alpha[cloud.layer];
    // Night clouds are dimmer
    const color = weather.isDay ? style.color : style.color.split(',').map(v => Math.round(Number(v) * 0.55)).join(',');
    c.fillStyle = `rgba(${color},${alpha})`;
    // Path is drawn relative to (x, y) = cloud anchor; anchor sits at (22s+pad, 40s+pad)
    const ox = 22 * s + pad;
    const oy = 40 * s + pad;
    drawCloudPath(c, ox, oy, s);
    sprite = { canvas, ox, oy };
    cloudSprites.set(key, sprite);
    return sprite;
  }

  function drawClouds(ctx, width, layers) {
    const count = (CLOUD_STYLE[weather.condition] || CLOUD_STYLE.clear).count;
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      if (i >= count) break;
      if (!layers.includes(c.layer)) continue;
      const speedFactor = (c.layer === 0 ? 0.15 : c.layer === 1 ? 0.3 : 0.5) * windFactor();
      const span = width + 300;
      const x = ((c.x - scroll * speedFactor) % span + span) % span - 150;
      const sprite = cloudSprite(c);
      ctx.drawImage(sprite.canvas, Math.round(x - sprite.ox), Math.round(c.y - sprite.oy));
    }
  }

  function updateWeather(width) {
    frame++;
    const wind = windFactor();
    const slant = (weather.windSpeed || 0) / 12; // px per step sideways
    for (const d of rain) {
      d.y += d.speed;
      d.x -= slant + 0.5;
      if (d.y > BASE_HEIGHT) { d.y = -d.len; d.x = Math.random() * (width + 200) - 100; }
      if (d.x < -100) d.x += width + 200;
    }
    for (const f of snow) {
      f.y += f.speed;
      f.x += Math.sin(frame / 40 + f.phase) * 0.6 - slant * 0.3;
      if (f.y > GROUND_Y) { f.y = -5; f.x = Math.random() * (width + 100) - 50; }
      if (f.x < -50) f.x += width + 100;
    }
    if (weather.condition === 'thunder') {
      if (frame >= nextFlashAt) {
        flash = 0.85;
        nextFlashAt = frame + 240 + Math.floor(Math.random() * 480); // every 4–12 s
      }
      flash *= 0.86;
    } else {
      flash = 0;
    }
    return wind;
  }

  function renderWeather(ctx, width) {
    if (rain.length) {
      ctx.strokeStyle = weather.isDay ? 'rgba(200, 215, 235, 0.55)' : 'rgba(170, 190, 220, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      const slant = (weather.windSpeed || 0) / 12 + 0.5;
      ctx.beginPath();
      for (const d of rain) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - slant * (d.len / d.speed), d.y - d.len);
      }
      ctx.stroke();
    }
    if (snow.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      for (const f of snow) {
        ctx.moveTo(f.x + f.r, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    if (weather.condition === 'fog') {
      const g = ctx.createLinearGradient(0, GROUND_Y - 260, 0, GROUND_Y + 20);
      g.addColorStop(0, 'rgba(235,238,242,0)');
      g.addColorStop(1, 'rgba(235,238,242,0.8)');
      ctx.fillStyle = g;
      ctx.fillRect(0, GROUND_Y - 260, width, 280);
    }
    if (flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.7})`;
      ctx.fillRect(0, 0, width, BASE_HEIGHT);
    }
  }

  return {
    _skyForBench() { return skyCanvas; },

    setWeather(next) {
      weather = { condition: 'clear', isDay: true, windSpeed: 0, ...next };
      seedPrecipitation(skyWidth || 1200);
      flash = 0;
      nextFlashAt = frame + 60;
    },

    getWeather() { return weather; },

    update(speed) {
      scroll += speed;
      updateWeather(skyWidth || 1200);
    },

    render(ctx, width) {
      ensureSky(width);
      ensureHills();
      ensureGroundPattern(ctx);

      ctx.drawImage(skyCanvas, 0, 0);

      drawClouds(ctx, width, [0, 1]);

      // Hills: one pre-rendered strip, wrapped
      const hx = -(((scroll * 0.4) % HILL_SPAN + HILL_SPAN) % HILL_SPAN);
      ctx.drawImage(hillCanvas, Math.round(hx), hillCanvas.top);
      if (hx + HILL_SPAN < width) {
        ctx.drawImage(hillCanvas, Math.round(hx + HILL_SPAN), hillCanvas.top);
      }

      // Ground: repeating pattern shifted with the scroll
      const gx = -(scroll % GROUND_TILE);
      ctx.save();
      ctx.translate(gx, GROUND_Y);
      ctx.fillStyle = groundPattern;
      ctx.fillRect(-gx, 0, width + GROUND_TILE, GROUND_HEIGHT);
      ctx.restore();

      // Ground tint: snow whitens the hills, night darkens them
      if (weather.condition === 'snow') {
        ctx.fillStyle = 'rgba(240, 245, 250, 0.6)';
        ctx.fillRect(0, GROUND_Y - 300, width, 300 + GROUND_HEIGHT);
      }
      if (!weather.isDay) {
        ctx.fillStyle = 'rgba(8, 16, 40, 0.45)';
        ctx.fillRect(0, GROUND_Y - 300, width, 300 + GROUND_HEIGHT);
      }

      drawClouds(ctx, width, [2]);
      renderWeather(ctx, width);
    }
  };
}
