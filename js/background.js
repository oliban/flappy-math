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
  for (let i = 0; i < 9; i++) {
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
  let hillCanvas = null;
  let groundPattern = null;
  let groundPatternCtx = null;
  const cloudSprites = new Map(); // key -> { canvas, ox, oy }

  function ensureSky(width) {
    if (skyCanvas && skyWidth === width) return;
    skyWidth = width;
    skyCanvas = makeCanvas(width, BASE_HEIGHT);
    const c = skyCanvas.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, BASE_HEIGHT);
    g.addColorStop(0, '#5DB7F5');
    g.addColorStop(0.55, '#A6DCFF');
    g.addColorStop(1, '#E8F7FF');
    c.fillStyle = g;
    c.fillRect(0, 0, width, BASE_HEIGHT);

    const sunX = width * 0.78;
    const sunY = 150;
    c.fillStyle = 'rgba(255, 236, 150, 0.35)';
    c.beginPath();
    c.arc(sunX, sunY, 70, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255, 236, 150, 0.9)';
    c.beginPath();
    c.arc(sunX, sunY, 46, 0, Math.PI * 2);
    c.fill();
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
    const key = `${cloud.layer}:${cloud.scale.toFixed(2)}`;
    let sprite = cloudSprites.get(key);
    if (sprite) return sprite;
    const s = cloud.scale;
    const pad = 4;
    // Cloud path spans x: -22s..80s and y: -40s..32s around its anchor
    const w = 102 * s + pad * 2;
    const h = 72 * s + pad * 2;
    const canvas = makeCanvas(w, h);
    const c = canvas.getContext('2d');
    const alpha = cloud.layer === 0 ? 0.55 : cloud.layer === 1 ? 0.8 : 0.95;
    c.fillStyle = `rgba(255,255,255,${alpha})`;
    // Path is drawn relative to (x, y) = cloud anchor; anchor sits at (22s+pad, 40s+pad)
    const ox = 22 * s + pad;
    const oy = 40 * s + pad;
    drawCloudPath(c, ox, oy, s);
    sprite = { canvas, ox, oy };
    cloudSprites.set(key, sprite);
    return sprite;
  }

  function drawClouds(ctx, width, layers) {
    for (const c of clouds) {
      if (!layers.includes(c.layer)) continue;
      const speedFactor = c.layer === 0 ? 0.15 : c.layer === 1 ? 0.3 : 0.5;
      const span = width + 300;
      const x = ((c.x - scroll * speedFactor) % span + span) % span - 150;
      const sprite = cloudSprite(c);
      ctx.drawImage(sprite.canvas, Math.round(x - sprite.ox), Math.round(c.y - sprite.oy));
    }
  }

  return {
    _skyForBench() { return skyCanvas; },

    update(speed) {
      scroll += speed;
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

      drawClouds(ctx, width, [2]);
    }
  };
}
