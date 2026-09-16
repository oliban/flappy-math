// Game pace, defined by how long a pipe takes to cross the screen rather than
// by pixels per frame. Phones in landscape have a canvas ~3x wider than tall,
// so a fixed px/frame speed felt like a crawl there; this keeps the feel
// identical on every screen shape.

export const STEPS_PER_SECOND = 60;
const BASE_CROSSING_SECONDS = 16;  // speed level 1 (old desktop feel was ~20 s)
const CROSSING_DECAY = 0.92;       // each level is ~8% faster; level 10 ≈ 7.5 s
const MIN_CROSSING_SECONDS = 2.5;

export function crossingSeconds(level) {
  const lvl = Math.max(1, level | 0);
  return Math.max(MIN_CROSSING_SECONDS, BASE_CROSSING_SECONDS * Math.pow(CROSSING_DECAY, lvl - 1));
}

// Horizontal pipe speed in canvas px per simulation step
export function pipeSpeedFor(level, canvasWidth) {
  return canvasWidth / (crossingSeconds(level) * STEPS_PER_SECOND);
}
