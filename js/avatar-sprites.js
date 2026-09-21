// Sprite cache for avatars: each (id, size) is pre-rendered into a small sheet of
// animation frames once, so per-frame drawing is a single drawImage instead of
// dozens of gradient-filled paths. Rotation is applied by the caller's transform.
import { drawAvatar } from './avatars.js';

const FRAMES = 12;            // animation frames across one 2π cycle
const SUPERSAMPLE = 2;        // render sheets at 2x for crisp downscale on retina
const sheets = new Map();     // key `${id}:${r}` -> { canvas, cell }
const tinted = new Map();     // same keys -> a red-washed copy for the hurt blink
const HURT_COLOR = '#F01818';

function buildSheet(id, r) {
  const cell = Math.ceil(r * 3.2) * SUPERSAMPLE; // room for ears, tails, hats
  const canvas = document.createElement('canvas');
  canvas.width = cell * FRAMES;
  canvas.height = cell;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < FRAMES; i++) {
    const phase = (i / FRAMES) * Math.PI * 2;
    ctx.save();
    ctx.translate(i * cell + cell / 2, cell / 2);
    ctx.scale(SUPERSAMPLE, SUPERSAMPLE);
    drawAvatar(ctx, id, r, phase);
    ctx.restore();
  }
  return { canvas, cell };
}

function getSheet(id, r) {
  const key = `${id}:${r}`;
  let sheet = sheets.get(key);
  if (!sheet) {
    sheet = buildSheet(id, r);
    sheets.set(key, sheet);
  }
  return sheet;
}

function frameIndex(phase) {
  return ((Math.round((phase / (Math.PI * 2)) * FRAMES) % FRAMES) + FRAMES) % FRAMES;
}

export function drawAvatarSprite(ctx, id, r, phase) {
  const { canvas, cell } = getSheet(id, Math.round(r));
  const size = cell / SUPERSAMPLE;
  ctx.drawImage(canvas, frameIndex(phase) * cell, 0, cell, cell, -size / 2, -size / 2, size, size);
}

// A red copy of a sheet, built once per (id, size). Tinting inside an offscreen
// canvas means 'source-atop' only touches the avatar's own pixels, so the blink
// never smears over the sky, and drawing it costs one extra drawImage.
function tintedSheet(key, sheet) {
  let red = tinted.get(key);
  if (!red) {
    const canvas = document.createElement('canvas');
    canvas.width = sheet.canvas.width;
    canvas.height = sheet.canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sheet.canvas, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = HURT_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    red = { canvas, cell: sheet.cell };
    tinted.set(key, red);
  }
  return red;
}

/** Draws the red hurt wash on top of an already drawn avatar. */
export function drawAvatarSpriteTint(ctx, id, r, phase, alpha) {
  const sheet = getSheet(id, Math.round(r));
  const red = tintedSheet(`${id}:${Math.round(r)}`, sheet);
  const frame = frameIndex(phase);
  const size = sheet.cell / SUPERSAMPLE;
  const previous = ctx.globalAlpha;
  ctx.globalAlpha = previous * alpha;
  ctx.drawImage(red.canvas, frame * red.cell, 0, red.cell, red.cell, -size / 2, -size / 2, size, size);
  ctx.globalAlpha = previous;
}

export function clearAvatarSprites() {
  sheets.clear();
  tinted.clear();
}
