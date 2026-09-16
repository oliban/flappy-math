// Sprite cache for avatars: each (id, size) is pre-rendered into a small sheet of
// animation frames once, so per-frame drawing is a single drawImage instead of
// dozens of gradient-filled paths. Rotation is applied by the caller's transform.
import { drawAvatar } from './avatars.js';

const FRAMES = 12;            // animation frames across one 2π cycle
const SUPERSAMPLE = 2;        // render sheets at 2x for crisp downscale on retina
const sheets = new Map();     // key `${id}:${r}` -> { canvas, cell }

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

export function drawAvatarSprite(ctx, id, r, phase) {
  const key = `${id}:${Math.round(r)}`;
  let sheet = sheets.get(key);
  if (!sheet) {
    sheet = buildSheet(id, Math.round(r));
    sheets.set(key, sheet);
  }
  const { canvas, cell } = sheet;
  const frame = ((Math.round((phase / (Math.PI * 2)) * FRAMES) % FRAMES) + FRAMES) % FRAMES;
  const size = cell / SUPERSAMPLE;
  ctx.drawImage(canvas, frame * cell, 0, cell, cell, -size / 2, -size / 2, size, size);
}

export function clearAvatarSprites() {
  sheets.clear();
}
