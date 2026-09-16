// Selectable player avatars, hand-modelled as vector characters drawn with
// Canvas 2D primitives, in the style of the original Flappy Math bird.
//
// Every draw(ctx, r, phase) renders a character centred on (0, 0) facing
// right (+x is forward). `r` is the body radius in pixels; `phase` is a
// continuously increasing float used for wing/paw/tail animation. The caller
// has already translated (and possibly rotated) the context.
//
// Internally each character is modelled in unit space (body radius = 1) and
// the context is scaled by r, so gradients are size-independent and can be
// cached per context.

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------
// Gradient cache: WeakMap<ctx, Map<key, CanvasGradient>>
// ---------------------------------------------------------------------------
const gradientCache = new WeakMap();

function radialGradient(ctx, key, stops, cx = -0.3, cy = -0.3, radius = 1.05) {
  let perCtx = gradientCache.get(ctx);
  if (!perCtx) {
    perCtx = new Map();
    gradientCache.set(ctx, perCtx);
  }
  let g = perCtx.get(key);
  if (!g) {
    g = ctx.createRadialGradient(cx, cy, 0, 0, 0, radius);
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    perCtx.set(key, g);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Primitive helpers (unit space)
// ---------------------------------------------------------------------------
function ellipsePath(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function fillEllipse(ctx, x, y, rx, ry, rot, fill, stroke, lw) {
  ellipsePath(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function fillCircle(ctx, x, y, radius, fill, stroke, lw) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function fillPolygon(ctx, points, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function strokeLine(ctx, x1, y1, x2, y2, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function strokeCurve(ctx, x1, y1, cx, cy, x2, y2, color, lw) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// Soft drop shadow under the body silhouette.
function bodyShadow(ctx, rx, ry, rot = 0) {
  ellipsePath(ctx, 0.13, 0.13, rx, ry, rot);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fill();
}

// One big expressive eye: white, optional iris, pupil, highlight.
function drawEye(ctx, x, y, s, opts = {}) {
  const { iris = null, pupilRx = 0.5, pupilRy = 0.5, outline = null, lw = 0.06 } = opts;
  fillCircle(ctx, x, y, s, '#FFFFFF', outline, lw);
  if (iris) fillCircle(ctx, x + 0.12 * s, y + 0.05 * s, 0.72 * s, iris);
  fillEllipse(ctx, x + 0.28 * s, y + 0.12 * s, pupilRx * s, pupilRy * s, 0, '#111111');
  fillCircle(ctx, x + 0.42 * s, y - 0.18 * s, 0.22 * s, '#FFFFFF');
}

// Small closed-lid arc for a sleepy/blink look (used for a far eye hint).
function drawSmile(ctx, x1, y1, cx, cy, x2, y2, color, lw) {
  strokeCurve(ctx, x1, y1, cx, cy, x2, y2, color, lw);
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

function drawBird(ctx, lw, phase) {
  const body = radialGradient(ctx, 'bird', [
    [0, '#FFE566'], [0.7, '#FFD700'], [1, '#E5A800']
  ]);
  const outline = '#CC8800';
  const wingY = Math.sin(phase) * 0.33;

  // Tail feathers (behind body)
  fillPolygon(ctx, [[-0.75, -0.1], [-1.35, -0.45], [-1.2, 0.05], [-1.35, 0.4], [-0.75, 0.25]], '#E5C100', outline, lw * 0.8);

  bodyShadow(ctx, 1, 0.85);
  fillEllipse(ctx, 0, 0, 1, 0.85, 0, body, outline, lw);

  // Head tuft
  fillPolygon(ctx, [[0.15, -0.8], [0.3, -1.15], [0.45, -0.82]], '#FFD700', outline, lw * 0.7);

  // Wing
  fillEllipse(ctx, -0.33, wingY, 0.5, 0.35, -0.3, '#E5C100', outline, lw * 0.7);

  drawEye(ctx, 0.35, -0.15, 0.35);

  // Beak
  fillPolygon(ctx, [[0.7, 0.1], [1.3, 0.25], [0.7, 0.45]], '#FF6B35', '#CC4400', lw * 0.6);
  strokeLine(ctx, 0.72, 0.28, 1.2, 0.25, '#CC4400', lw * 0.6);
}

function drawCat(ctx, lw, phase) {
  const body = radialGradient(ctx, 'cat', [
    [0, '#FFC177'], [0.65, '#FF9F3D'], [1, '#D9711A']
  ]);
  const outline = '#B85E12';
  const dark = '#C96A17';
  const swing = Math.sin(phase);

  // Tail (behind body) - curls upward and sways
  ctx.beginPath();
  ctx.moveTo(-0.75, 0.35);
  ctx.quadraticCurveTo(-1.35, 0.4 + swing * 0.15, -1.3, -0.35 + swing * 0.3);
  ctx.strokeStyle = outline;
  ctx.lineWidth = 0.34;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.strokeStyle = '#FF9F3D';
  ctx.lineWidth = 0.22;
  ctx.stroke();

  // Ears (behind body so bases are hidden)
  const earPink = '#FFB3C1';
  fillPolygon(ctx, [[-0.7, -0.5], [-0.62, -1.3], [-0.05, -0.85]], '#FF9F3D', outline, lw);
  fillPolygon(ctx, [[-0.58, -0.68], [-0.55, -1.1], [-0.2, -0.85]], earPink);
  fillPolygon(ctx, [[0.15, -0.85], [0.5, -1.35], [0.75, -0.6]], '#FF9F3D', outline, lw);
  fillPolygon(ctx, [[0.3, -0.85], [0.5, -1.15], [0.62, -0.7]], earPink);

  bodyShadow(ctx, 1, 0.95);
  fillEllipse(ctx, 0, 0, 1, 0.95, 0, body, outline, lw);

  // Forehead tabby stripes
  strokeLine(ctx, -0.05, -0.75, -0.02, -0.5, dark, lw * 1.1);
  strokeLine(ctx, 0.18, -0.85, 0.2, -0.58, dark, lw * 1.1);
  strokeLine(ctx, -0.28, -0.6, -0.24, -0.4, dark, lw * 1.1);

  // Paw (front, paddles)
  fillEllipse(ctx, 0.05, 0.62 + swing * 0.08, 0.32, 0.2, 0.2, '#FF9F3D', outline, lw * 0.8);

  // Muzzle
  fillEllipse(ctx, 0.62, 0.32, 0.42, 0.3, 0, '#FFF3E6', '#E8C9A8', lw * 0.6);
  // Mouth
  strokeCurve(ctx, 0.62, 0.36, 0.72, 0.5, 0.86, 0.38, '#B85E12', lw * 0.7);
  // Whiskers
  strokeLine(ctx, 0.85, 0.32, 1.35, 0.2, '#6B3A0D', lw * 0.6);
  strokeLine(ctx, 0.85, 0.42, 1.35, 0.48, '#6B3A0D', lw * 0.6);
  strokeLine(ctx, 0.3, 0.42, -0.1, 0.35, '#6B3A0D', lw * 0.6);
  strokeLine(ctx, 0.3, 0.5, -0.05, 0.62, '#6B3A0D', lw * 0.6);

  // Eye with vertical pupil, green iris
  drawEye(ctx, 0.32, -0.2, 0.3, { iris: '#7CCB3F', pupilRx: 0.22, pupilRy: 0.5 });

  // Pink nose
  fillPolygon(ctx, [[0.78, 0.15], [1.02, 0.15], [0.9, 0.3]], '#FF7A9A', '#D14F72', lw * 0.5);
}

function drawFrog(ctx, lw, phase) {
  const body = radialGradient(ctx, 'frog', [
    [0, '#A6EE62'], [0.65, '#6CC93A'], [1, '#3E9A22']
  ]);
  const outline = '#2E7A18';
  const swing = Math.sin(phase);

  // Back leg (behind body) - kicks
  fillEllipse(ctx, -0.55, 0.55 + swing * 0.1, 0.5, 0.24, 0.5 - swing * 0.2, '#5FBF32', outline, lw * 0.8);
  fillEllipse(ctx, -0.9, 0.7 + swing * 0.15, 0.22, 0.12, 0.2, '#5FBF32', outline, lw * 0.7);

  bodyShadow(ctx, 1, 0.8);
  fillEllipse(ctx, 0, 0.05, 1, 0.8, 0, body, outline, lw);

  // Belly
  fillEllipse(ctx, 0.2, 0.35, 0.68, 0.4, 0, '#E3FBB4');

  // Bulging eyes on top of head
  const eyes = [[-0.3, -0.72, 0.3], [0.45, -0.68, 0.34]];
  for (const [ex, ey, es] of eyes) {
    fillCircle(ctx, ex, ey, es, '#6CC93A', outline, lw);
    fillCircle(ctx, ex + 0.02, ey - 0.02, es * 0.72, '#FFFFFF');
    fillEllipse(ctx, ex + 0.1 * es, ey, es * 0.42, es * 0.36, 0, '#111111');
    fillCircle(ctx, ex + 0.25 * es, ey - 0.25 * es, es * 0.16, '#FFFFFF');
  }

  // Wide smile
  strokeCurve(ctx, -0.4, 0.15, 0.3, 0.55, 0.9, 0.05, outline, lw * 1.1);
  // Nostrils
  fillCircle(ctx, 0.72, -0.18, 0.045, outline);
  fillCircle(ctx, 0.86, -0.12, 0.045, outline);
  // Blush
  fillEllipse(ctx, 0.15, 0.05, 0.16, 0.09, 0, 'rgba(255, 120, 120, 0.45)');

  // Front hand
  fillEllipse(ctx, 0.55, 0.62 - swing * 0.06, 0.26, 0.15, -0.2, '#5FBF32', outline, lw * 0.8);
}

function drawPenguin(ctx, lw, phase) {
  const body = radialGradient(ctx, 'penguin', [
    [0, '#5A6C8F'], [0.6, '#2F3D5C'], [1, '#161E33']
  ]);
  const outline = '#0E1424';
  const flap = Math.sin(phase);

  // Feet (behind body)
  fillEllipse(ctx, 0.3, 0.92, 0.3, 0.12, 0.1, '#FF9F2E', '#C76A00', lw * 0.7);
  fillEllipse(ctx, -0.15, 0.95, 0.28, 0.11, -0.1, '#FF9F2E', '#C76A00', lw * 0.7);

  bodyShadow(ctx, 0.88, 1.0);
  fillEllipse(ctx, 0, 0, 0.88, 1.0, 0, body, outline, lw);

  // White belly
  fillEllipse(ctx, 0.2, 0.28, 0.58, 0.66, 0, '#FFFFFF');
  // Face patch
  fillEllipse(ctx, 0.45, -0.38, 0.36, 0.32, 0, '#FFFFFF');

  // Flipper - swings from the shoulder
  ctx.save();
  ctx.translate(-0.25, -0.1);
  ctx.rotate(0.55 + flap * 0.55);
  fillEllipse(ctx, -0.25, 0.1, 0.55, 0.22, 0, '#2F3D5C', outline, lw * 0.8);
  ctx.restore();

  drawEye(ctx, 0.42, -0.4, 0.22, { outline: '#0E1424', lw: lw * 0.5 });

  // Beak
  fillPolygon(ctx, [[0.7, -0.35], [1.25, -0.18], [0.7, -0.02]], '#FF9F2E', '#C76A00', lw * 0.6);
  strokeLine(ctx, 0.72, -0.2, 1.15, -0.18, '#C76A00', lw * 0.6);
  // Blush
  fillEllipse(ctx, 0.5, -0.08, 0.13, 0.07, 0, 'rgba(255, 140, 140, 0.55)');
}

function drawOwl(ctx, lw, phase) {
  const body = radialGradient(ctx, 'owl', [
    [0, '#C89860'], [0.65, '#A06A3A'], [1, '#6E4520']
  ]);
  const outline = '#4E2F12';
  const flap = Math.sin(phase);

  // Ear tufts (behind body)
  fillPolygon(ctx, [[-0.75, -0.45], [-0.85, -1.2], [-0.2, -0.85]], '#8C5A2B', outline, lw);
  fillPolygon(ctx, [[0.15, -0.9], [0.65, -1.25], [0.75, -0.5]], '#8C5A2B', outline, lw);

  // Feet
  fillEllipse(ctx, 0.35, 0.95, 0.22, 0.1, 0, '#F2A23A', '#B86D12', lw * 0.6);
  fillEllipse(ctx, -0.1, 0.98, 0.22, 0.1, 0, '#F2A23A', '#B86D12', lw * 0.6);

  bodyShadow(ctx, 0.95, 1.0);
  fillEllipse(ctx, 0, 0, 0.95, 1.0, 0, body, outline, lw);

  // Belly with feather V-marks
  fillEllipse(ctx, 0.12, 0.42, 0.58, 0.5, 0, '#E5C79A');
  const vColor = '#8C5A2B';
  const vs = [[0.0, 0.2], [0.3, 0.25], [-0.15, 0.48], [0.15, 0.52], [0.45, 0.55], [0.0, 0.76], [0.3, 0.8]];
  for (const [vx, vy] of vs) {
    ctx.beginPath();
    ctx.moveTo(vx - 0.1, vy - 0.08);
    ctx.lineTo(vx, vy + 0.04);
    ctx.lineTo(vx + 0.1, vy - 0.08);
    ctx.strokeStyle = vColor;
    ctx.lineWidth = lw * 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Wing
  ctx.save();
  ctx.translate(-0.4, -0.05);
  ctx.rotate(-0.35 + flap * 0.35);
  fillEllipse(ctx, -0.15, 0.2, 0.42, 0.55, 0, '#7A4C22', outline, lw * 0.8);
  // Wing feather lines
  strokeLine(ctx, -0.25, 0.35, -0.2, 0.7, '#5A3515', lw * 0.6);
  strokeLine(ctx, -0.05, 0.4, 0.0, 0.72, '#5A3515', lw * 0.6);
  ctx.restore();

  // Facial disc
  fillEllipse(ctx, 0.3, -0.3, 0.6, 0.5, 0, '#F1DCB6', '#B98C55', lw * 0.6);

  // Large round eye with amber iris
  drawEye(ctx, 0.35, -0.3, 0.36, { iris: '#F5A623', outline: '#4E2F12', lw: lw * 0.6, pupilRx: 0.42, pupilRy: 0.42 });

  // Small beak
  fillPolygon(ctx, [[0.72, -0.05], [0.98, 0.1], [0.72, 0.25]], '#5E4420', '#3B2810', lw * 0.5);
}

function drawFox(ctx, lw, phase) {
  const body = radialGradient(ctx, 'fox', [
    [0, '#FFB061'], [0.65, '#FF8A2A'], [1, '#D65E0C']
  ]);
  const outline = '#A8460A';
  const fur = '#FF8A2A';
  const swing = Math.sin(phase);

  // Bushy tail with white tip (behind body)
  ctx.save();
  ctx.translate(-0.7, 0.2);
  ctx.rotate(0.35 + swing * 0.18);
  fillEllipse(ctx, -0.55, 0, 0.7, 0.36, 0, fur, outline, lw);
  fillEllipse(ctx, -1.05, 0, 0.28, 0.3, 0, '#FFF7EE');
  ctx.restore();

  // Ears: tall triangles, dark tips
  fillPolygon(ctx, [[-0.75, -0.4], [-0.6, -1.35], [-0.05, -0.8]], fur, outline, lw);
  fillPolygon(ctx, [[-0.66, -0.98], [-0.6, -1.35], [-0.35, -1.12]], '#3B2412');
  fillPolygon(ctx, [[0.1, -0.85], [0.45, -1.4], [0.72, -0.6]], fur, outline, lw);
  fillPolygon(ctx, [[0.32, -1.2], [0.45, -1.4], [0.56, -1.12]], '#3B2412');
  // Inner ear
  fillPolygon(ctx, [[0.28, -0.82], [0.46, -1.1], [0.6, -0.72]], '#FFDCC2');

  bodyShadow(ctx, 1, 0.9);
  fillEllipse(ctx, 0, 0, 1, 0.9, 0, body, outline, lw);

  // White chest / cheek fur
  fillEllipse(ctx, 0.3, 0.45, 0.62, 0.4, 0, '#FFF7EE');
  // White muzzle
  fillEllipse(ctx, 0.68, 0.22, 0.44, 0.32, 0.1, '#FFF7EE', '#E6C7A8', lw * 0.6);

  // Paw
  fillEllipse(ctx, 0.05, 0.7 + swing * 0.07, 0.3, 0.18, 0.2, '#3B2412');

  // Eye (slightly slanted look via pupil)
  drawEye(ctx, 0.3, -0.22, 0.28, { iris: '#C98A2B' });
  // Brow for a sly look
  strokeLine(ctx, 0.05, -0.55, 0.45, -0.6, outline, lw * 0.9);

  // Black nose
  fillEllipse(ctx, 1.05, 0.2, 0.12, 0.1, 0, '#1E1E1E');
  fillCircle(ctx, 1.02, 0.16, 0.035, '#FFFFFF');
  // Mouth
  strokeCurve(ctx, 0.95, 0.32, 0.85, 0.45, 0.7, 0.36, '#A8460A', lw * 0.6);
}

function drawPanda(ctx, lw, phase) {
  const body = radialGradient(ctx, 'panda', [
    [0, '#FFFFFF'], [0.6, '#F4F4F4'], [1, '#CDCDCD']
  ]);
  const outline = '#6A6A6A';
  const black = '#1C1C1C';
  const swing = Math.sin(phase);

  // Ears (behind body)
  fillCircle(ctx, -0.5, -0.72, 0.34, black);
  fillCircle(ctx, 0.5, -0.75, 0.32, black);

  // Legs
  fillEllipse(ctx, 0.35, 0.85, 0.3, 0.2, 0.1, black);
  fillEllipse(ctx, -0.2, 0.88, 0.3, 0.2, -0.1, black);

  bodyShadow(ctx, 1, 0.95);
  fillEllipse(ctx, 0, 0, 1, 0.95, 0, body, outline, lw);

  // Black arm (front, paddles)
  fillEllipse(ctx, -0.15, 0.35 + swing * 0.1, 0.5, 0.28, 0.35 + swing * 0.1, black);

  // Eye patch + eye
  fillEllipse(ctx, 0.36, -0.15, 0.28, 0.36, 0.5, black);
  drawEye(ctx, 0.4, -0.15, 0.15, { pupilRx: 0.55, pupilRy: 0.55 });
  // Far eye patch hint
  fillEllipse(ctx, -0.35, -0.25, 0.14, 0.24, -0.3, black);

  // Nose and mouth
  fillEllipse(ctx, 0.88, 0.2, 0.13, 0.1, 0, black);
  strokeCurve(ctx, 0.85, 0.32, 0.72, 0.5, 0.55, 0.38, '#444444', lw * 0.7);
  // Blush
  fillEllipse(ctx, 0.5, 0.3, 0.16, 0.09, 0, 'rgba(255, 130, 130, 0.45)');
}

function drawRabbit(ctx, lw, phase) {
  const body = radialGradient(ctx, 'rabbit', [
    [0, '#FFFFFF'], [0.6, '#F1EAE0'], [1, '#C9BBA8']
  ]);
  const outline = '#8F7C66';
  const fur = '#F1EAE0';
  const pink = '#FFB6C7';
  const swing = Math.sin(phase);

  // Puffy tail (behind body)
  fillCircle(ctx, -0.92, 0.25, 0.3, '#FFFFFF', outline, lw * 0.8);
  fillCircle(ctx, -1.05, 0.05, 0.16, '#FFFFFF');
  fillCircle(ctx, -1.1, 0.4, 0.15, '#FFFFFF');

  // Ears: long ellipses with pink inner, swaying
  const ears = [[-0.32, -0.12 - swing * 0.08], [0.22, 0.14 + swing * 0.08]];
  for (const [ex, rot] of ears) {
    ctx.save();
    ctx.translate(ex, -0.7);
    ctx.rotate(rot);
    fillEllipse(ctx, 0, -0.55, 0.22, 0.65, 0, fur, outline, lw);
    fillEllipse(ctx, 0, -0.55, 0.11, 0.48, 0, pink);
    ctx.restore();
  }

  // Back foot
  fillEllipse(ctx, -0.35, 0.78 + swing * 0.06, 0.38, 0.17, 0.1, fur, outline, lw * 0.8);

  bodyShadow(ctx, 0.95, 0.9);
  fillEllipse(ctx, 0, 0, 0.95, 0.9, 0, body, outline, lw);

  // Front paw
  fillEllipse(ctx, 0.45, 0.68 - swing * 0.05, 0.26, 0.15, -0.1, fur, outline, lw * 0.8);

  // Cheek
  fillEllipse(ctx, 0.62, 0.3, 0.36, 0.26, 0, '#FFFFFF');

  drawEye(ctx, 0.32, -0.18, 0.3, { iris: '#5A7FD6' });

  // Pink nose
  fillEllipse(ctx, 0.9, 0.12, 0.1, 0.08, 0, '#FF7FA0', '#D9557C', lw * 0.5);
  // Mouth
  strokeLine(ctx, 0.9, 0.2, 0.88, 0.34, '#9C7B62', lw * 0.6);
  strokeCurve(ctx, 0.75, 0.32, 0.88, 0.46, 1.0, 0.32, '#9C7B62', lw * 0.6);
  // Buck teeth
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#B8A48C';
  ctx.lineWidth = lw * 0.5;
  ctx.beginPath();
  ctx.rect(0.8, 0.38, 0.09, 0.14);
  ctx.rect(0.9, 0.38, 0.09, 0.14);
  ctx.fill();
  ctx.stroke();
  // Whiskers
  strokeLine(ctx, 0.95, 0.25, 1.35, 0.15, '#8F7C66', lw * 0.5);
  strokeLine(ctx, 0.95, 0.32, 1.35, 0.4, '#8F7C66', lw * 0.5);
}

// ===========================================================================
// Parametric character system
//
// Beyond the 8 hand-modelled starters, every character is data: a body base
// (silhouette + species features), a colour palette, a piece of headgear, an
// eye style and a small extra. The roster is generated deterministically from
// a seeded PRNG so ids are stable across loads (they live in LocalStorage).
// ===========================================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// ---- Extra primitives -----------------------------------------------------
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fill, stroke, lw) {
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function starPath(ctx, cx, cy, outer, inner, points, rot) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const ang = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(ang) * rad;
    const y = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function fillStar(ctx, cx, cy, outer, inner, points, rot, fill, stroke, lw) {
  starPath(ctx, cx, cy, outer, inner, points, rot);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function strokeEllipse(ctx, x, y, rx, ry, color, lw) {
  ellipsePath(ctx, x, y, rx, ry, 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function bodyGradient(ctx, P) {
  return radialGradient(ctx, 'pal:' + P.id, [[0, P.light], [0.65, P.base], [1, P.dark]]);
}

// Shadow + gradient ellipse + outline, the standard round body.
function roundBody(ctx, lw, P, rx, ry, cx = 0, cy = 0) {
  ellipsePath(ctx, cx + 0.13, cy + 0.13, rx, ry, 0);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fill();
  fillEllipse(ctx, cx, cy, rx, ry, 0, bodyGradient(ctx, P), P.outline, lw);
}

const PINK_INNER = '#FFB3C1';
const BEAK = '#FF9F2E';
const BEAK_DARK = '#C76A00';

// ---- Palettes -------------------------------------------------------------
const PALETTES = [
  { id: 'sunny',     family: 'yellow', light: '#FFE566', base: '#FFD700', dark: '#E5A800', outline: '#B37A00', belly: '#FFF6C2', accent: '#3A7BD5' },
  { id: 'tangerine', family: 'orange', light: '#FFC177', base: '#FF9F3D', dark: '#D9711A', outline: '#9E4E0C', belly: '#FFF1DE', accent: '#3FA34D' },
  { id: 'cherry',    family: 'red',    light: '#FF8A80', base: '#F0453D', dark: '#B8231D', outline: '#7E120F', belly: '#FFE3DF', accent: '#2E86DE' },
  { id: 'bubblegum', family: 'pink',   light: '#FFC4DF', base: '#FF8DC0', dark: '#D9558F', outline: '#9A2F62', belly: '#FFF0F7', accent: '#5AB0FF' },
  { id: 'lavender',  family: 'purple', light: '#D9C4FF', base: '#B48BFF', dark: '#8558D6', outline: '#5A3399', belly: '#F1E9FF', accent: '#FFB347' },
  { id: 'grape',     family: 'purple', light: '#B07CE0', base: '#7E3FBF', dark: '#552686', outline: '#361458', belly: '#E8D6F7', accent: '#F5D442' },
  { id: 'sky',       family: 'blue',   light: '#A9E1FF', base: '#5FBDF5', dark: '#2F86C7', outline: '#1B5A8C', belly: '#EAF7FF', accent: '#FF9F2E' },
  { id: 'ocean',     family: 'blue',   light: '#6FA0FF', base: '#3366DD', dark: '#1F3FA0', outline: '#132766', belly: '#DCE6FF', accent: '#FFD700' },
  { id: 'mint',      family: 'green',  light: '#C9FFE6', base: '#7FE3B4', dark: '#3FB884', outline: '#217A54', belly: '#F0FFF7', accent: '#F26B8A' },
  { id: 'forest',    family: 'green',  light: '#8CCB6A', base: '#4E9A3C', dark: '#2F6B25', outline: '#1D4517', belly: '#E4F2C9', accent: '#F5A623' },
  { id: 'lime',      family: 'green',  light: '#E4FF7A', base: '#B5E534', dark: '#7FA818', outline: '#4F6B0B', belly: '#F7FFD6', accent: '#8E44AD' },
  { id: 'teal',      family: 'teal',   light: '#7FE5E0', base: '#2BB5AE', dark: '#177F7A', outline: '#0D5350', belly: '#DDFAF8', accent: '#FF7A59' },
  { id: 'cocoa',     family: 'brown',  light: '#B8825A', base: '#8A5632', dark: '#5C3619', outline: '#3B2110', belly: '#EBD3B5', accent: '#F5A623' },
  { id: 'cream',     family: 'cream',  light: '#FFFFFF', base: '#F3E9D8', dark: '#D3C1A5', outline: '#8F7C66', belly: '#FFFFFF', accent: '#5A7FD6' },
  { id: 'slate',     family: 'grey',   light: '#B9C4D6', base: '#7F8DA6', dark: '#526078', outline: '#2E3A4E', belly: '#E6ECF5', accent: '#FF6B35' },
  { id: 'midnight',  family: 'dark',   light: '#5A6C8F', base: '#2F3D5C', dark: '#161E33', outline: '#0B1020', belly: '#DDE4F5', accent: '#FFD700' }
];

// Headgear colour sets, chosen to contrast with the body palette.
const TINTS = [
  { family: 'red',    light: '#FF7B72', base: '#E53935', dark: '#9E1B16' },
  { family: 'blue',   light: '#6EB6FF', base: '#2F7FD6', dark: '#174A85' },
  { family: 'green',  light: '#7FD97A', base: '#3FA34D', dark: '#22672B' },
  { family: 'purple', light: '#C39BFF', base: '#8A5CE0', dark: '#54318F' },
  { family: 'pink',   light: '#FFA8D2', base: '#F26BA8', dark: '#A83A6E' },
  { family: 'teal',   light: '#7FE0DA', base: '#26A69A', dark: '#146A62' },
  { family: 'orange', light: '#FFB86B', base: '#F7931E', dark: '#A85E0B' },
  { family: 'yellow', light: '#FFF07A', base: '#FFD72E', dark: '#B39200' }
];

// ---- Eyes -----------------------------------------------------------------
function makeEye(style, P) {
  return function eye(ctx, x, y, s, opts = {}) {
    if (style === 'bead') {
      fillCircle(ctx, x, y, s * 0.62, '#111111');
      fillCircle(ctx, x + 0.22 * s, y - 0.22 * s, 0.2 * s, '#FFFFFF');
    } else if (style === 'happy') {
      fillCircle(ctx, x, y, s, '#FFFFFF', opts.outline, opts.lw || 0.06);
      ctx.beginPath();
      ctx.arc(x + 0.05 * s, y + 0.2 * s, 0.5 * s, Math.PI, TAU);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = s * 0.34;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      drawEye(ctx, x, y, s, { iris: P.accent, ...opts });
    }
  };
}

// ---- Extras (body patterns) -------------------------------------------------
function drawDecor(ctx, lw, extra, P) {
  if (extra === 'spots') {
    for (const [x, y, rad] of [[-0.45, -0.15, 0.14], [-0.12, 0.35, 0.12], [-0.55, 0.32, 0.1], [0.05, -0.42, 0.1]]) {
      fillCircle(ctx, x, y, rad, P.dark);
    }
  } else if (extra === 'stripes') {
    strokeCurve(ctx, -0.6, -0.45, -0.38, -0.08, -0.6, 0.3, P.dark, lw * 1.6);
    strokeCurve(ctx, -0.28, -0.58, -0.06, -0.15, -0.28, 0.32, P.dark, lw * 1.6);
  } else if (extra === 'blush') {
    fillEllipse(ctx, 0.52, 0.28, 0.17, 0.09, 0, 'rgba(255, 110, 110, 0.5)');
  } else if (extra === 'freckles') {
    for (const [x, y] of [[0.45, 0.16], [0.56, 0.27], [0.4, 0.32]]) fillCircle(ctx, x, y, 0.035, 'rgba(60, 30, 10, 0.55)');
  }
}

function drawSparkles(ctx, phase) {
  const spots = [[0.95, -1.05, 0], [-1.15, -0.75, 2.1], [1.2, 0.65, 4.2]];
  for (const [x, y, off] of spots) {
    const s = 0.14 + 0.07 * Math.sin(phase * 1.7 + off);
    fillStar(ctx, x, y, s, s * 0.38, 4, -Math.PI / 2, '#FFF59D', '#FFFFFF', 0.03);
  }
}

// ---- Body bases -------------------------------------------------------------
// Each base paints the whole creature (back features, shadow, body, belly,
// front features, eye, nose) in unit space. `E` gives it the eye style, the
// decor pass and the current hat id. `anchors` place headgear: `head` is the
// top of the skull, `eye` the front eye, `neck` where a scarf wraps, `back`
// where a cape hangs from.
const ROUND_ANCHORS = {
  head: { x: 0.05, y: -0.9, s: 1 },
  eye: { x: 0.33, y: -0.18, s: 0.3 },
  neck: { x: 0.1, y: 0.45, s: 1 },
  back: { x: -0.2, y: -0.55, s: 1 }
};

function anchors(over = {}) {
  return { ...ROUND_ANCHORS, ...over };
}

const BASES = [
  {
    id: 'bird', species: 'Bird',
    anchors: anchors({ head: { x: 0.1, y: -0.85, s: 1 }, eye: { x: 0.35, y: -0.15, s: 0.35 } }),
    paint(ctx, lw, ph, P, E) {
      const wingY = Math.sin(ph) * 0.33;
      fillPolygon(ctx, [[-0.75, -0.1], [-1.35, -0.45], [-1.2, 0.05], [-1.35, 0.4], [-0.75, 0.25]], P.dark, P.outline, lw * 0.8);
      roundBody(ctx, lw, P, 1, 0.85);
      E.decor(ctx);
      fillPolygon(ctx, [[0.15, -0.8], [0.3, -1.15], [0.45, -0.82]], P.base, P.outline, lw * 0.7);
      fillEllipse(ctx, -0.33, wingY, 0.5, 0.35, -0.3, P.dark, P.outline, lw * 0.7);
      E.eye(ctx, 0.35, -0.15, 0.35);
      fillPolygon(ctx, [[0.7, 0.1], [1.3, 0.25], [0.7, 0.45]], '#FF6B35', '#CC4400', lw * 0.6);
      strokeLine(ctx, 0.72, 0.28, 1.2, 0.25, '#CC4400', lw * 0.6);
    }
  },
  {
    id: 'cat', species: 'Cat',
    anchors: anchors({ head: { x: 0.0, y: -0.95, s: 1 }, eye: { x: 0.32, y: -0.2, s: 0.3 } }),
    paint(ctx, lw, ph, P, E) {
      const swing = Math.sin(ph);
      ctx.beginPath();
      ctx.moveTo(-0.75, 0.35);
      ctx.quadraticCurveTo(-1.35, 0.4 + swing * 0.15, -1.3, -0.35 + swing * 0.3);
      ctx.strokeStyle = P.outline; ctx.lineWidth = 0.34; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = P.base; ctx.lineWidth = 0.22; ctx.stroke();
      fillPolygon(ctx, [[-0.7, -0.5], [-0.62, -1.3], [-0.05, -0.85]], P.base, P.outline, lw);
      fillPolygon(ctx, [[-0.58, -0.68], [-0.55, -1.1], [-0.2, -0.85]], PINK_INNER);
      fillPolygon(ctx, [[0.15, -0.85], [0.5, -1.35], [0.75, -0.6]], P.base, P.outline, lw);
      fillPolygon(ctx, [[0.3, -0.85], [0.5, -1.15], [0.62, -0.7]], PINK_INNER);
      roundBody(ctx, lw, P, 1, 0.95);
      E.decor(ctx);
      strokeLine(ctx, -0.05, -0.75, -0.02, -0.5, P.dark, lw * 1.1);
      strokeLine(ctx, 0.18, -0.85, 0.2, -0.58, P.dark, lw * 1.1);
      fillEllipse(ctx, 0.05, 0.62 + swing * 0.08, 0.32, 0.2, 0.2, P.base, P.outline, lw * 0.8);
      fillEllipse(ctx, 0.62, 0.32, 0.42, 0.3, 0, P.belly, P.dark, lw * 0.5);
      strokeCurve(ctx, 0.62, 0.36, 0.72, 0.5, 0.86, 0.38, P.outline, lw * 0.7);
      strokeLine(ctx, 0.85, 0.32, 1.35, 0.2, P.outline, lw * 0.6);
      strokeLine(ctx, 0.85, 0.42, 1.35, 0.48, P.outline, lw * 0.6);
      E.eye(ctx, 0.32, -0.2, 0.3, { pupilRx: 0.22, pupilRy: 0.5 });
      fillPolygon(ctx, [[0.78, 0.15], [1.02, 0.15], [0.9, 0.3]], '#FF7A9A', '#D14F72', lw * 0.5);
    }
  },
  {
    id: 'frog', species: 'Frog', noHats: ['glasses', 'sunglasses', 'ninja', 'knight', 'viking'],
    anchors: anchors({ head: { x: 0.05, y: -1.1, s: 0.8 } }),
    paint(ctx, lw, ph, P, E) {
      const swing = Math.sin(ph);
      fillEllipse(ctx, -0.55, 0.55 + swing * 0.1, 0.5, 0.24, 0.5 - swing * 0.2, P.dark, P.outline, lw * 0.8);
      fillEllipse(ctx, -0.9, 0.7 + swing * 0.15, 0.22, 0.12, 0.2, P.dark, P.outline, lw * 0.7);
      roundBody(ctx, lw, P, 1, 0.8, 0, 0.05);
      fillEllipse(ctx, 0.2, 0.35, 0.68, 0.4, 0, P.belly);
      E.decor(ctx);
      for (const [ex, ey, es] of [[-0.3, -0.72, 0.3], [0.45, -0.68, 0.34]]) {
        fillCircle(ctx, ex, ey, es, P.base, P.outline, lw);
        E.eye(ctx, ex + 0.02, ey - 0.02, es * 0.72, { pupilRx: 0.42, pupilRy: 0.38 });
      }
      strokeCurve(ctx, -0.4, 0.15, 0.3, 0.55, 0.9, 0.05, P.outline, lw * 1.1);
      fillCircle(ctx, 0.72, -0.18, 0.045, P.outline);
      fillCircle(ctx, 0.86, -0.12, 0.045, P.outline);
      fillEllipse(ctx, 0.55, 0.62 - swing * 0.06, 0.26, 0.15, -0.2, P.dark, P.outline, lw * 0.8);
    }
  },
  {
    id: 'penguin', species: 'Penguin',
    anchors: anchors({ head: { x: 0.1, y: -0.98, s: 0.95 }, eye: { x: 0.42, y: -0.4, s: 0.22 }, neck: { x: 0.1, y: 0.5, s: 1 } }),
    paint(ctx, lw, ph, P, E) {
      const flap = Math.sin(ph);
      fillEllipse(ctx, 0.3, 0.92, 0.3, 0.12, 0.1, BEAK, BEAK_DARK, lw * 0.7);
      fillEllipse(ctx, -0.15, 0.95, 0.28, 0.11, -0.1, BEAK, BEAK_DARK, lw * 0.7);
      roundBody(ctx, lw, P, 0.88, 1.0);
      fillEllipse(ctx, 0.2, 0.28, 0.58, 0.66, 0, P.belly);
      fillEllipse(ctx, 0.45, -0.38, 0.36, 0.32, 0, P.belly);
      E.decor(ctx);
      ctx.save();
      ctx.translate(-0.25, -0.1);
      ctx.rotate(0.55 + flap * 0.55);
      fillEllipse(ctx, -0.25, 0.1, 0.55, 0.22, 0, P.base, P.outline, lw * 0.8);
      ctx.restore();
      E.eye(ctx, 0.42, -0.4, 0.22, { outline: P.outline, lw: lw * 0.5 });
      fillPolygon(ctx, [[0.7, -0.35], [1.25, -0.18], [0.7, -0.02]], BEAK, BEAK_DARK, lw * 0.6);
      strokeLine(ctx, 0.72, -0.2, 1.15, -0.18, BEAK_DARK, lw * 0.6);
      fillEllipse(ctx, 0.5, -0.08, 0.13, 0.07, 0, 'rgba(255, 140, 140, 0.55)');
    }
  },
  {
    id: 'owl', species: 'Owl',
    anchors: anchors({ head: { x: 0, y: -0.95, s: 1 }, eye: { x: 0.35, y: -0.3, s: 0.36 } }),
    paint(ctx, lw, ph, P, E) {
      const flap = Math.sin(ph);
      fillPolygon(ctx, [[-0.75, -0.45], [-0.85, -1.2], [-0.2, -0.85]], P.dark, P.outline, lw);
      fillPolygon(ctx, [[0.15, -0.9], [0.65, -1.25], [0.75, -0.5]], P.dark, P.outline, lw);
      fillEllipse(ctx, 0.35, 0.95, 0.22, 0.1, 0, BEAK, BEAK_DARK, lw * 0.6);
      fillEllipse(ctx, -0.1, 0.98, 0.22, 0.1, 0, BEAK, BEAK_DARK, lw * 0.6);
      roundBody(ctx, lw, P, 0.95, 1.0);
      fillEllipse(ctx, 0.12, 0.42, 0.58, 0.5, 0, P.belly);
      for (const [vx, vy] of [[0.0, 0.2], [0.3, 0.25], [-0.15, 0.48], [0.15, 0.52], [0.45, 0.55], [0.0, 0.76], [0.3, 0.8]]) {
        ctx.beginPath();
        ctx.moveTo(vx - 0.1, vy - 0.08);
        ctx.lineTo(vx, vy + 0.04);
        ctx.lineTo(vx + 0.1, vy - 0.08);
        ctx.strokeStyle = P.dark; ctx.lineWidth = lw * 0.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke();
      }
      E.decor(ctx);
      ctx.save();
      ctx.translate(-0.4, -0.05);
      ctx.rotate(-0.35 + flap * 0.35);
      fillEllipse(ctx, -0.15, 0.2, 0.42, 0.55, 0, P.dark, P.outline, lw * 0.8);
      ctx.restore();
      fillEllipse(ctx, 0.3, -0.3, 0.6, 0.5, 0, P.belly, P.dark, lw * 0.6);
      E.eye(ctx, 0.35, -0.3, 0.36, { outline: P.outline, lw: lw * 0.6, pupilRx: 0.42, pupilRy: 0.42 });
      fillPolygon(ctx, [[0.72, -0.05], [0.98, 0.1], [0.72, 0.25]], '#5E4420', '#3B2810', lw * 0.5);
    }
  },
  {
    id: 'fox', species: 'Fox',
    anchors: anchors({ head: { x: 0, y: -0.9, s: 1 }, eye: { x: 0.3, y: -0.22, s: 0.28 } }),
    paint(ctx, lw, ph, P, E) {
      const swing = Math.sin(ph);
      ctx.save();
      ctx.translate(-0.7, 0.2);
      ctx.rotate(0.35 + swing * 0.18);
      fillEllipse(ctx, -0.55, 0, 0.7, 0.36, 0, P.base, P.outline, lw);
      fillEllipse(ctx, -1.05, 0, 0.28, 0.3, 0, P.belly);
      ctx.restore();
      fillPolygon(ctx, [[-0.75, -0.4], [-0.6, -1.35], [-0.05, -0.8]], P.base, P.outline, lw);
      fillPolygon(ctx, [[-0.66, -0.98], [-0.6, -1.35], [-0.35, -1.12]], P.outline);
      fillPolygon(ctx, [[0.1, -0.85], [0.45, -1.4], [0.72, -0.6]], P.base, P.outline, lw);
      fillPolygon(ctx, [[0.32, -1.2], [0.45, -1.4], [0.56, -1.12]], P.outline);
      fillPolygon(ctx, [[0.28, -0.82], [0.46, -1.1], [0.6, -0.72]], P.belly);
      roundBody(ctx, lw, P, 1, 0.9);
      fillEllipse(ctx, 0.3, 0.45, 0.62, 0.4, 0, P.belly);
      E.decor(ctx);
      fillEllipse(ctx, 0.68, 0.22, 0.44, 0.32, 0.1, P.belly, P.dark, lw * 0.5);
      fillEllipse(ctx, 0.05, 0.7 + swing * 0.07, 0.3, 0.18, 0.2, P.outline);
      E.eye(ctx, 0.3, -0.22, 0.28);
      strokeLine(ctx, 0.05, -0.55, 0.45, -0.6, P.outline, lw * 0.9);
      fillEllipse(ctx, 1.05, 0.2, 0.12, 0.1, 0, '#1E1E1E');
      fillCircle(ctx, 1.02, 0.16, 0.035, '#FFFFFF');
      strokeCurve(ctx, 0.95, 0.32, 0.85, 0.45, 0.7, 0.36, P.outline, lw * 0.6);
    }
  },
  {
    id: 'bear', species: 'Bear',
    anchors: anchors({ eye: { x: 0.33, y: -0.15, s: 0.24 } }),
    paint(ctx, lw, ph, P, E) {
      const swing = Math.sin(ph);
      fillCircle(ctx, -0.55, -0.7, 0.32, P.base, P.outline, lw);
      fillCircle(ctx, -0.55, -0.7, 0.17, P.light);
      fillCircle(ctx, 0.5, -0.72, 0.3, P.base, P.outline, lw);
      fillCircle(ctx, 0.5, -0.72, 0.16, P.light);
      fillEllipse(ctx, 0.35, 0.85, 0.3, 0.2, 0.1, P.dark, P.outline, lw * 0.7);
      fillEllipse(ctx, -0.2, 0.88, 0.3, 0.2, -0.1, P.dark, P.outline, lw * 0.7);
      roundBody(ctx, lw, P, 1, 0.95);
      E.decor(ctx);
      fillEllipse(ctx, -0.15, 0.4 + swing * 0.1, 0.48, 0.26, 0.35 + swing * 0.1, P.dark, P.outline, lw * 0.7);
      fillEllipse(ctx, 0.65, 0.3, 0.42, 0.3, 0, P.belly, P.dark, lw * 0.5);
      fillEllipse(ctx, 0.85, 0.18, 0.14, 0.1, 0, '#2A1A10');
      strokeCurve(ctx, 0.72, 0.4, 0.62, 0.52, 0.5, 0.42, P.outline, lw * 0.6);
      E.eye(ctx, 0.33, -0.15, 0.24);
    }
  },
  {
    id: 'rabbit', species: 'Bunny',
    anchors: anchors({ head: { x: -0.05, y: -0.85, s: 0.9 }, eye: { x: 0.32, y: -0.18, s: 0.3 } }),
    paint(ctx, lw, ph, P, E) {
      const swing = Math.sin(ph);
      fillCircle(ctx, -0.92, 0.25, 0.3, P.light, P.outline, lw * 0.8);
      fillCircle(ctx, -1.05, 0.05, 0.16, P.light);
      fillCircle(ctx, -1.1, 0.4, 0.15, P.light);
      for (const [ex, rot] of [[-0.32, -0.12 - swing * 0.08], [0.22, 0.14 + swing * 0.08]]) {
        ctx.save();
        ctx.translate(ex, -0.7);
        ctx.rotate(rot);
        fillEllipse(ctx, 0, -0.55, 0.22, 0.65, 0, P.base, P.outline, lw);
        fillEllipse(ctx, 0, -0.55, 0.11, 0.48, 0, PINK_INNER);
        ctx.restore();
      }
      fillEllipse(ctx, -0.35, 0.78 + swing * 0.06, 0.38, 0.17, 0.1, P.base, P.outline, lw * 0.8);
      roundBody(ctx, lw, P, 0.95, 0.9);
      E.decor(ctx);
      fillEllipse(ctx, 0.45, 0.68 - swing * 0.05, 0.26, 0.15, -0.1, P.base, P.outline, lw * 0.8);
      fillEllipse(ctx, 0.62, 0.3, 0.36, 0.26, 0, P.belly);
      E.eye(ctx, 0.32, -0.18, 0.3);
      fillEllipse(ctx, 0.9, 0.12, 0.1, 0.08, 0, '#FF7FA0', '#D9557C', lw * 0.5);
      strokeLine(ctx, 0.9, 0.2, 0.88, 0.34, P.outline, lw * 0.6);
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = P.outline; ctx.lineWidth = lw * 0.5;
      ctx.beginPath(); ctx.rect(0.8, 0.36, 0.09, 0.14); ctx.rect(0.9, 0.36, 0.09, 0.14); ctx.fill(); ctx.stroke();
      strokeLine(ctx, 0.95, 0.25, 1.35, 0.15, P.outline, lw * 0.5);
      strokeLine(ctx, 0.95, 0.32, 1.35, 0.4, P.outline, lw * 0.5);
    }
  },
  {
    id: 'dog', species: 'Pup',
    anchors: anchors({ eye: { x: 0.3, y: -0.2, s: 0.28 } }),
    paint(ctx, lw, ph, P, E) {
      const swing = Math.sin(ph);
      ctx.beginPath();
      ctx.moveTo(-0.8, 0.1);
      ctx.quadraticCurveTo(-1.2, 0.1, -1.35, -0.45 + swing * 0.25);
      ctx.strokeStyle = P.outline; ctx.lineWidth = 0.3; ctx.lineCap = 'round'; ctx.stroke();
      ctx.strokeStyle = P.base; ctx.lineWidth = 0.18; ctx.stroke();
      ctx.save(); ctx.translate(-0.55, -0.6); ctx.rotate(0.7);
      fillEllipse(ctx, 0, 0.45, 0.22, 0.5, 0, P.dark, P.outline, lw);
      ctx.restore();
      roundBody(ctx, lw, P, 1, 0.92);
      E.decor(ctx);
      ctx.save(); ctx.translate(0.05, -0.8); ctx.rotate(0.95 + swing * 0.05);
      fillEllipse(ctx, 0, 0.45, 0.22, 0.5, 0, P.dark, P.outline, lw);
      ctx.restore();
      fillEllipse(ctx, 0.65, 0.28, 0.44, 0.32, 0, P.belly, P.dark, lw * 0.5);
      strokeCurve(ctx, 0.95, 0.3, 0.8, 0.47, 0.62, 0.38, P.outline, lw * 0.6);
      fillEllipse(ctx, 0.8, 0.52, 0.1, 0.15, 0, '#FF6F91', '#C94A6E', lw * 0.4);
      fillEllipse(ctx, 0.98, 0.14, 0.14, 0.11, 0, '#222222');
      fillEllipse(ctx, 0.1, 0.7 + swing * 0.06, 0.3, 0.17, 0.15, P.base, P.outline, lw * 0.7);
      E.eye(ctx, 0.3, -0.2, 0.28);
    }
  },
  {
    id: 'mouse', species: 'Mouse',
    anchors: anchors({ head: { x: 0, y: -0.85, s: 0.9 }, eye: { x: 0.35, y: -0.2, s: 0.26 } }),
    paint(ctx, lw, ph, P, E) {
      const swing = Math.sin(ph);
      strokeCurve(ctx, -0.8, 0.3, -1.4, 0.6 + swing * 0.2, -1.6, -0.1 + swing * 0.3, P.outline, 0.14);
      strokeCurve(ctx, -0.8, 0.3, -1.4, 0.6 + swing * 0.2, -1.6, -0.1 + swing * 0.3, PINK_INNER, 0.07);
      fillCircle(ctx, -0.45, -0.75, 0.38, P.base, P.outline, lw);
      fillCircle(ctx, -0.45, -0.75, 0.24, PINK_INNER);
      fillCircle(ctx, 0.4, -0.78, 0.35, P.base, P.outline, lw);
      fillCircle(ctx, 0.4, -0.78, 0.22, PINK_INNER);
      fillEllipse(ctx, 0.7, 0.12, 0.6, 0.34, 0.15, P.base, P.outline, lw);
      roundBody(ctx, lw, P, 1, 0.85);
      E.decor(ctx);
      fillCircle(ctx, 1.26, 0.2, 0.11, '#FF7FA0', '#D9557C', lw * 0.5);
      strokeLine(ctx, 1.1, 0.25, 1.5, 0.05, P.outline, lw * 0.5);
      strokeLine(ctx, 1.1, 0.32, 1.5, 0.45, P.outline, lw * 0.5);
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = P.outline; ctx.lineWidth = lw * 0.5;
      ctx.beginPath(); ctx.rect(1.02, 0.32, 0.08, 0.13); ctx.rect(1.11, 0.32, 0.08, 0.13); ctx.fill(); ctx.stroke();
      fillEllipse(ctx, 0.2, 0.68 + swing * 0.06, 0.26, 0.15, 0.1, P.base, P.outline, lw * 0.7);
      E.eye(ctx, 0.35, -0.2, 0.26);
    }
  }
];

BASES.push(
  {
    id: 'pig', species: 'Piggy',
    anchors: anchors({ eye: { x: 0.3, y: -0.2, s: 0.26 } }),
    paint(ctx, lw, ph, P, E) {
      const swing = Math.sin(ph);
      ctx.beginPath();
      ctx.arc(-1.05, 0.05 + swing * 0.05, 0.14, 0.4, TAU * 0.85);
      ctx.strokeStyle = P.dark; ctx.lineWidth = lw * 1.6; ctx.lineCap = 'round'; ctx.stroke();
      fillPolygon(ctx, [[-0.7, -0.5], [-0.6, -1.05], [-0.15, -0.8]], P.base, P.outline, lw);
      fillPolygon(ctx, [[-0.6, -0.6], [-0.56, -0.9], [-0.3, -0.75]], P.dark);
      fillPolygon(ctx, [[0.2, -0.85], [0.5, -1.1], [0.7, -0.6]], P.base, P.outline, lw);
      fillPolygon(ctx, [[0.32, -0.8], [0.5, -0.95], [0.6, -0.65]], P.dark);
      fillEllipse(ctx, 0.35, 0.88, 0.26, 0.16, 0, P.dark, P.outline, lw * 0.6);
      fillEllipse(ctx, -0.2, 0.9, 0.26, 0.16, 0, P.dark, P.outline, lw * 0.6);
      roundBody(ctx, lw, P, 1, 0.92);
      E.decor(ctx);
      fillEllipse(ctx, 0.85, 0.2, 0.36, 0.27, 0, P.light, P.outline, lw * 0.8);
      fillEllipse(ctx, 0.76, 0.2, 0.06, 0.09, 0, P.dark);
      fillEllipse(ctx, 0.95, 0.2, 0.06, 0.09, 0, P.dark);
      fillEllipse(ctx, 0.45, 0.22, 0.14, 0.08, 0, 'rgba(255, 110, 110, 0.45)');
      E.eye(ctx, 0.3, -0.2, 0.26);
    }
  },
  {
    id: 'fish', species: 'Fish',
    anchors: anchors({ head: { x: 0.2, y: -0.7, s: 0.85 }, eye: { x: 0.5, y: -0.15, s: 0.27 }, neck: { x: 0.25, y: 0.35, s: 0.9 }, back: { x: -0.1, y: -0.45, s: 0.9 } }),
    paint(ctx, lw, ph, P, E) {
      const sw = Math.sin(ph);
      fillPolygon(ctx, [[-0.85, 0], [-1.45, -0.55 + sw * 0.12], [-1.25, 0], [-1.45, 0.55 - sw * 0.12]], P.dark, P.outline, lw);
      fillPolygon(ctx, [[-0.5, -0.55], [-0.1, -1.05], [0.3, -0.6]], P.dark, P.outline, lw);
      roundBody(ctx, lw, P, 1.05, 0.7);
      fillEllipse(ctx, 0.25, 0.3, 0.6, 0.32, 0, P.belly);
      E.decor(ctx);
      for (const [x, y] of [[-0.35, -0.15], [-0.1, 0.1], [-0.5, 0.25]]) {
        ctx.beginPath();
        ctx.arc(x, y, 0.16, Math.PI * 0.15, Math.PI * 0.85);
        ctx.strokeStyle = P.dark; ctx.lineWidth = lw * 0.7; ctx.lineCap = 'round'; ctx.stroke();
      }
      fillEllipse(ctx, -0.05, 0.28 + sw * 0.05, 0.32, 0.16, 0.5 + sw * 0.2, P.dark, P.outline, lw * 0.7);
      E.eye(ctx, 0.5, -0.15, 0.27);
      strokeCurve(ctx, 0.88, 0.22, 1.0, 0.32, 1.06, 0.1, P.outline, lw * 0.9);
      for (let i = 0; i < 3; i++) {
        const b = (ph * 0.12 + i * 0.37) % 1;
        strokeEllipse(ctx, 1.25 + i * 0.12, -0.15 - b * 0.9, 0.05 + 0.03 * i, 0.05 + 0.03 * i, 'rgba(255, 255, 255, 0.85)', lw * 0.6);
      }
    }
  },
  {
    id: 'octopus', species: 'Octopus',
    anchors: anchors({ head: { x: 0, y: -1.0, s: 1 }, eye: { x: 0.38, y: -0.2, s: 0.3 }, neck: { x: 0, y: 0.45, s: 1 } }),
    paint(ctx, lw, ph, P, E) {
      for (let i = 0; i < 5; i++) {
        const x = -0.75 + i * 0.37;
        const wx = Math.sin(ph + i * 1.3) * 0.22;
        strokeCurve(ctx, x, 0.4, x + wx, 0.9, x + wx * 1.8, 1.25, P.outline, 0.3);
        strokeCurve(ctx, x, 0.4, x + wx, 0.9, x + wx * 1.8, 1.25, P.base, 0.18);
        fillCircle(ctx, x + wx * 0.7, 0.85, 0.04, P.light);
        fillCircle(ctx, x + wx * 1.4, 1.1, 0.04, P.light);
      }
      roundBody(ctx, lw, P, 0.95, 0.85, 0, -0.15);
      E.decor(ctx);
      strokeCurve(ctx, 0.2, 0.3, 0.45, 0.48, 0.72, 0.28, P.outline, lw * 0.8);
      fillEllipse(ctx, 0.62, 0.12, 0.14, 0.08, 0, 'rgba(255, 110, 110, 0.45)');
      E.eye(ctx, 0.38, -0.2, 0.3);
      E.eye(ctx, -0.3, -0.25, 0.2);
    }
  },
  {
    id: 'ghost', species: 'Ghost',
    anchors: anchors({ head: { x: 0, y: -0.95, s: 1 }, eye: { x: 0.32, y: -0.28, s: 0.28 }, neck: { x: 0, y: 0.35, s: 0.95 } }),
    paint(ctx, lw, ph, P, E) {
      const sw = Math.sin(ph);
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(-0.9, 0.55);
        ctx.lineTo(-0.9, -0.05);
        ctx.arc(0, -0.05, 0.9, Math.PI, 0);
        ctx.lineTo(0.9, 0.55);
        ctx.quadraticCurveTo(0.68, 0.98, 0.45, 0.6);
        ctx.quadraticCurveTo(0.22, 0.98, 0, 0.62);
        ctx.quadraticCurveTo(-0.22, 0.98, -0.45, 0.6);
        ctx.quadraticCurveTo(-0.68, 0.98, -0.9, 0.55);
        ctx.closePath();
      };
      ctx.save();
      ctx.translate(0, sw * 0.06);
      fillEllipse(ctx, -0.8, 0.25 - sw * 0.08, 0.3, 0.15, 0.4, P.base, P.outline, lw * 0.7);
      ctx.save(); ctx.translate(0.13, 0.13); body(); ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fill(); ctx.restore();
      body();
      ctx.fillStyle = bodyGradient(ctx, P); ctx.fill();
      ctx.strokeStyle = P.outline; ctx.lineWidth = lw; ctx.stroke();
      E.decor(ctx);
      fillEllipse(ctx, 0.8, 0.3 + sw * 0.08, 0.3, 0.15, -0.4, P.base, P.outline, lw * 0.7);
      E.eye(ctx, 0.32, -0.28, 0.28);
      E.eye(ctx, -0.28, -0.32, 0.22);
      fillEllipse(ctx, 0.35, 0.22, 0.11, 0.14, 0, P.outline);
      ctx.restore();
    }
  },
  {
    id: 'robot', species: 'Robot', noHats: ['antenna'],
    anchors: anchors({ head: { x: 0, y: -0.88, s: 1 }, eye: { x: 0.4, y: -0.3, s: 0.2 }, neck: { x: 0, y: 0.5, s: 1 } }),
    paint(ctx, lw, ph, P, E) {
      const sw = Math.sin(ph);
      const blink = Math.sin(ph * 2) > 0;
      if (E.hat === 'none') {
        strokeLine(ctx, 0, -0.85, 0, -1.15, P.outline, lw * 1.6);
        fillCircle(ctx, 0, -1.22, 0.13, blink ? '#FF5252' : '#B71C1C', '#7F0000', lw * 0.6);
      }
      fillEllipse(ctx, 0.4, 0.92, 0.25, 0.12, 0, P.dark, P.outline, lw * 0.6);
      fillEllipse(ctx, -0.4, 0.92, 0.25, 0.12, 0, P.dark, P.outline, lw * 0.6);
      strokeLine(ctx, 0.85, 0.3, 1.15, 0.3 + sw * 0.12, P.outline, lw * 2.2);
      fillCircle(ctx, 1.2, 0.3 + sw * 0.12, 0.13, P.dark, P.outline, lw * 0.6);
      ctx.save(); ctx.translate(0.13, 0.13); roundRectPath(ctx, -0.85, -0.85, 1.7, 1.7, 0.3); ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fill(); ctx.restore();
      fillRoundRect(ctx, -0.85, -0.85, 1.7, 1.7, 0.3, bodyGradient(ctx, P), P.outline, lw);
      E.decor(ctx);
      for (const [x, y] of [[-0.68, -0.68], [0.68, -0.68], [-0.68, 0.68], [0.68, 0.68]]) fillCircle(ctx, x, y, 0.06, P.dark);
      fillRoundRect(ctx, -0.62, 0.15, 0.78, 0.5, 0.1, P.dark, P.outline, lw * 0.6);
      fillCircle(ctx, -0.44, 0.4, 0.08, '#FF5252');
      fillCircle(ctx, -0.23, 0.4, 0.08, '#FFD740');
      fillCircle(ctx, -0.02, 0.4, 0.08, '#69F0AE');
      fillRoundRect(ctx, 0.02, -0.58, 0.76, 0.52, 0.14, '#DDF3FF', P.outline, lw * 0.7);
      E.eye(ctx, 0.4, -0.3, 0.2, { iris: '#1FA7E0' });
      strokeLine(ctx, 0.25, 0.1, 0.72, 0.1, P.outline, lw);
      strokeLine(ctx, 0.4, 0.05, 0.4, 0.15, P.outline, lw * 0.7);
      strokeLine(ctx, 0.56, 0.05, 0.56, 0.15, P.outline, lw * 0.7);
    }
  },
  {
    id: 'slime', species: 'Slime',
    anchors: anchors({ head: { x: 0.15, y: -0.85, s: 0.95 }, eye: { x: 0.38, y: -0.15, s: 0.3 }, neck: { x: 0, y: 0.4, s: 1 } }),
    paint(ctx, lw, ph, P, E) {
      const sq = Math.sin(ph) * 0.04;
      const blob = () => {
        ctx.beginPath();
        ctx.moveTo(-1.0, 0.55);
        ctx.bezierCurveTo(-1.1, -0.3, -0.7, -0.75, -0.25, -0.7);
        ctx.bezierCurveTo(-0.1, -1.05, 0.5, -1.0, 0.55, -0.7);
        ctx.bezierCurveTo(0.95, -0.6, 1.1, -0.1, 1.0, 0.4);
        ctx.quadraticCurveTo(0.95, 0.85, 0.5, 0.85);
        ctx.lineTo(-0.7, 0.85);
        ctx.quadraticCurveTo(-1.05, 0.85, -1.0, 0.55);
        ctx.closePath();
      };
      ctx.save();
      ctx.scale(1 + sq, 1 - sq);
      ctx.save(); ctx.translate(0.13, 0.13); blob(); ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fill(); ctx.restore();
      blob();
      ctx.fillStyle = bodyGradient(ctx, P); ctx.fill();
      ctx.strokeStyle = P.outline; ctx.lineWidth = lw; ctx.stroke();
      E.decor(ctx);
      fillCircle(ctx, -0.5, 0.35, 0.09, 'rgba(0, 0, 0, 0.12)');
      fillCircle(ctx, -0.25, 0.55, 0.06, 'rgba(0, 0, 0, 0.12)');
      fillEllipse(ctx, -0.35, -0.4, 0.26, 0.12, -0.5, 'rgba(255, 255, 255, 0.55)');
      strokeCurve(ctx, -0.05, 0.3, 0.35, 0.62, 0.72, 0.28, P.outline, lw);
      E.eye(ctx, 0.38, -0.15, 0.3);
      E.eye(ctx, -0.3, -0.2, 0.22);
      ctx.restore();
    }
  },
  {
    id: 'dragon', species: 'Dragon', noHats: ['horns', 'viking'],
    anchors: anchors({ head: { x: -0.1, y: -0.9, s: 0.9 }, eye: { x: 0.3, y: -0.2, s: 0.3 } }),
    paint(ctx, lw, ph, P, E) {
      const sw = Math.sin(ph);
      ctx.save();
      ctx.translate(-0.3, -0.55);
      ctx.rotate(-0.3 + sw * 0.35);
      fillPolygon(ctx, [[0, 0], [-0.9, -0.9], [-0.55, -0.35], [-1.15, -0.3], [-0.65, 0.05], [-0.95, 0.4], [0, 0.25]], P.dark, P.outline, lw);
      ctx.restore();
      strokeCurve(ctx, -0.85, 0.3, -1.4, 0.5 + sw * 0.1, -1.5, -0.1 + sw * 0.2, P.outline, 0.3);
      strokeCurve(ctx, -0.85, 0.3, -1.4, 0.5 + sw * 0.1, -1.5, -0.1 + sw * 0.2, P.base, 0.18);
      fillPolygon(ctx, [[-1.5, -0.1 + sw * 0.2], [-1.78, -0.42 + sw * 0.2], [-1.28, -0.4 + sw * 0.2]], P.dark, P.outline, lw * 0.6);
      fillPolygon(ctx, [[-0.5, -0.75], [-0.68, -1.25], [-0.2, -0.85]], '#F3E7C9', '#8D7B5A', lw * 0.7);
      fillPolygon(ctx, [[0.15, -0.85], [0.25, -1.3], [0.5, -0.75]], '#F3E7C9', '#8D7B5A', lw * 0.7);
      fillEllipse(ctx, 0.85, 0.2, 0.42, 0.28, 0, P.base, P.outline, lw);
      roundBody(ctx, lw, P, 1, 0.9);
      fillEllipse(ctx, 0.25, 0.35, 0.6, 0.42, 0, P.belly);
      strokeLine(ctx, 0.0, 0.3, 0.55, 0.3, P.dark, lw * 0.6);
      strokeLine(ctx, -0.05, 0.5, 0.6, 0.5, P.dark, lw * 0.6);
      E.decor(ctx);
      fillCircle(ctx, 1.15, 0.12, 0.05, P.outline);
      strokeCurve(ctx, 0.85, 0.36, 1.0, 0.46, 1.2, 0.32, P.outline, lw * 0.7);
      fillPolygon(ctx, [[1.0, 0.38], [1.05, 0.52], [1.1, 0.38]], '#FFFFFF');
      fillEllipse(ctx, 0.35, 0.7, 0.28, 0.16, 0, P.dark, P.outline, lw * 0.7);
      E.eye(ctx, 0.3, -0.2, 0.3, { pupilRx: 0.22, pupilRy: 0.5 });
      strokeLine(ctx, 0.05, -0.55, 0.5, -0.55, P.outline, lw);
    }
  },
  {
    id: 'bug', species: 'Bee', noHats: ['antenna'],
    anchors: anchors({ head: { x: 0.05, y: -0.85, s: 0.9 }, eye: { x: 0.42, y: -0.15, s: 0.3 } }),
    paint(ctx, lw, ph, P, E) {
      const sw = Math.sin(ph);
      const flap = Math.sin(ph * 3);
      strokeCurve(ctx, -0.15, -0.75, -0.35, -1.2, -0.55 + sw * 0.05, -1.3, P.outline, lw * 1.3);
      fillCircle(ctx, -0.55 + sw * 0.05, -1.3, 0.1, P.dark);
      strokeCurve(ctx, 0.3, -0.78, 0.5, -1.15, 0.72 + sw * 0.05, -1.25, P.outline, lw * 1.3);
      fillCircle(ctx, 0.72 + sw * 0.05, -1.25, 0.1, P.dark);
      for (const [x1, x2] of [[-0.45, -0.6], [0.0, -0.1], [0.4, 0.35]]) strokeLine(ctx, x1, 0.7, x2, 1.02, P.outline, lw * 1.4);
      fillPolygon(ctx, [[-0.95, 0.05], [-1.3, 0.22], [-0.95, 0.4]], P.outline);
      roundBody(ctx, lw, P, 1, 0.8);
      ctx.save();
      ellipsePath(ctx, 0, 0, 1, 0.8, 0);
      ctx.clip();
      ctx.fillStyle = P.dark;
      ctx.fillRect(-0.62, -1, 0.26, 2);
      ctx.fillRect(-0.12, -1, 0.24, 2);
      ctx.restore();
      E.decor(ctx);
      fillEllipse(ctx, -0.4, -0.72 - flap * 0.05, 0.55, 0.2, -0.5 + flap * 0.2, 'rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.95)', lw * 0.6);
      fillEllipse(ctx, -0.15, -0.75 + flap * 0.05, 0.4, 0.15, -0.25 - flap * 0.2, 'rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.95)', lw * 0.6);
      E.eye(ctx, 0.42, -0.15, 0.3);
      strokeCurve(ctx, 0.55, 0.3, 0.7, 0.45, 0.9, 0.28, P.outline, lw * 0.8);
    }
  },
  {
    id: 'cactus', species: 'Cactus', noHats: ['flower'],
    anchors: anchors({ head: { x: 0, y: -1.0, s: 0.9 }, eye: { x: 0.3, y: -0.2, s: 0.27 }, neck: { x: 0, y: 0.45, s: 0.85 } }),
    paint(ctx, lw, ph, P, E) {
      const sw = Math.sin(ph);
      fillEllipse(ctx, -0.75, 0.15, 0.3, 0.18, 0, P.base, P.outline, lw);
      fillEllipse(ctx, -0.88, -0.15 + sw * 0.03, 0.2, 0.42, 0, P.base, P.outline, lw);
      fillEllipse(ctx, 0.75, 0.25, 0.3, 0.18, 0, P.base, P.outline, lw);
      fillEllipse(ctx, 0.88, -0.02 - sw * 0.03, 0.2, 0.38, 0, P.base, P.outline, lw);
      roundBody(ctx, lw, P, 0.78, 1.0);
      E.decor(ctx);
      for (const [x, y] of [[-0.35, -0.55], [0.2, -0.7], [-0.45, 0.1], [0.4, 0.2], [-0.15, 0.6], [0.3, 0.68], [-0.05, -0.15], [-0.85, -0.3], [0.88, 0.05]]) {
        strokeLine(ctx, x - 0.07, y - 0.05, x + 0.07, y + 0.05, P.belly, lw * 0.7);
        strokeLine(ctx, x - 0.07, y + 0.05, x + 0.07, y - 0.05, P.belly, lw * 0.7);
      }
      if (E.hat === 'none') {
        for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 - Math.PI / 2;
          fillCircle(ctx, 0.1 + Math.cos(a) * 0.2, -1.0 + Math.sin(a) * 0.2, 0.14, '#FF8DC0', '#B04A80', lw * 0.4);
        }
        fillCircle(ctx, 0.1, -1.0, 0.12, '#FFD54F', '#B8860B', lw * 0.4);
      }
      strokeCurve(ctx, 0.25, 0.3, 0.42, 0.46, 0.62, 0.3, P.outline, lw * 0.9);
      fillEllipse(ctx, 0.52, 0.15, 0.13, 0.08, 0, 'rgba(255, 110, 110, 0.45)');
      E.eye(ctx, 0.3, -0.2, 0.27);
    }
  },
  {
    id: 'star', species: 'Star', noDecor: true, noHats: ['scarf', 'headphones'],
    anchors: anchors({ head: { x: 0, y: -0.82, s: 0.75 }, eye: { x: 0.3, y: -0.1, s: 0.28 }, back: { x: -0.2, y: -0.35, s: 0.9 } }),
    paint(ctx, lw, ph, P, E) {
      ctx.save();
      ctx.rotate(Math.sin(ph) * 0.08);
      starPath(ctx, 0.13, 0.13, 1.2, 0.6, 5, -Math.PI / 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.fill();
      fillStar(ctx, 0, 0, 1.2, 0.6, 5, -Math.PI / 2, bodyGradient(ctx, P), P.outline, lw);
      strokeCurve(ctx, -0.08, 0.32, 0.15, 0.55, 0.4, 0.3, P.outline, lw);
      fillEllipse(ctx, 0.5, 0.12, 0.13, 0.08, 0, 'rgba(255, 110, 110, 0.5)');
      fillEllipse(ctx, -0.45, 0.1, 0.13, 0.08, 0, 'rgba(255, 110, 110, 0.5)');
      E.eye(ctx, 0.3, -0.1, 0.28);
      E.eye(ctx, -0.28, -0.12, 0.21);
      ctx.restore();
    }
  }
);

// ---- Headgear ---------------------------------------------------------------
// Painted in the anchor's frame: origin at the anchor, scaled by anchor.s.
// `T` is the hat tint, `P` the body palette, `E` the eye/decor helpers.
const SILVER = '#DDE3EA';
const SILVER_DARK = '#5A6675';

function domePath(ctx, cx, cy, radius, bottom) {
  ctx.beginPath();
  ctx.moveTo(cx - radius, bottom);
  ctx.lineTo(cx - radius, cy);
  ctx.arc(cx, cy, radius, Math.PI, 0);
  ctx.lineTo(cx + radius, bottom);
  ctx.closePath();
}

function fillDome(ctx, cx, cy, radius, bottom, fill, stroke, lw) {
  domePath(ctx, cx, cy, radius, bottom);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

const HATS = [
  { id: 'none', tier: 'common', paint() {} },
  {
    id: 'cap', tier: 'common',
    paint(ctx, lw, ph, T) {
      fillDome(ctx, 0, 0.22, 0.72, 0.3, T.base, T.dark, lw);
      fillEllipse(ctx, 0.95, 0.25, 0.5, 0.13, 0, T.dark, T.dark, lw * 0.5);
      strokeLine(ctx, 0, -0.5, 0, 0.25, T.dark, lw * 0.7);
      fillCircle(ctx, 0, -0.5, 0.1, T.dark);
    }
  },
  {
    id: 'headband', tier: 'common',
    paint(ctx, lw, ph, T) {
      const sw = Math.sin(ph);
      strokeCurve(ctx, -0.8, 0.45, 0, 0.15, 0.82, 0.45, T.base, 0.22);
      strokeCurve(ctx, -0.8, 0.45, 0, 0.15, 0.82, 0.45, '#FFFFFF', 0.06);
      strokeCurve(ctx, -0.8, 0.45, -1.1, 0.3 + sw * 0.1, -1.4, 0.5 + sw * 0.15, T.base, 0.12);
      strokeCurve(ctx, -0.8, 0.45, -1.05, 0.55 + sw * 0.1, -1.35, 0.75 + sw * 0.1, T.base, 0.12);
    }
  },
  {
    id: 'glasses', tier: 'common', at: 'eye',
    paint(ctx, lw) {
      fillCircle(ctx, 0, 0, 1.3, 'rgba(200, 230, 255, 0.25)', '#333333', lw * 1.3);
      fillCircle(ctx, -2.45, -0.15, 0.95, 'rgba(200, 230, 255, 0.25)', '#333333', lw * 1.3);
      strokeCurve(ctx, -1.3, -0.2, -1.75, -0.6, -1.5, -0.25, '#333333', lw * 1.3);
    }
  },
  {
    id: 'sunglasses', tier: 'common', at: 'eye',
    paint(ctx, lw) {
      fillEllipse(ctx, -2.45, -0.1, 0.75, 0.75, 0, '#1E1E2E');
      strokeLine(ctx, -1.35, -0.2, -2.7, -0.95, '#1E1E2E', lw * 1.6);
      fillEllipse(ctx, 0.05, 0.05, 1.45, 1.15, 0, '#1E1E2E', '#000000', lw * 0.8);
      strokeCurve(ctx, -0.7, -0.5, -0.2, -0.85, 0.5, -0.6, 'rgba(255, 255, 255, 0.55)', lw * 1.3);
    }
  },
  {
    id: 'bow', tier: 'common',
    paint(ctx, lw, ph, T) {
      ctx.save();
      ctx.translate(0.35, -0.05);
      ctx.rotate(-0.25);
      fillPolygon(ctx, [[0, 0], [-0.48, -0.38], [-0.48, 0.32]], T.base, T.dark, lw);
      fillPolygon(ctx, [[0, 0], [0.48, -0.38], [0.48, 0.32]], T.base, T.dark, lw);
      fillCircle(ctx, 0, 0, 0.14, T.dark);
      ctx.restore();
    }
  },
  {
    id: 'antenna', tier: 'common',
    paint(ctx, lw, ph) {
      const sw = Math.sin(ph);
      strokeCurve(ctx, 0, 0.15, 0.05 + sw * 0.1, -0.35, 0.15 + sw * 0.25, -0.7, '#555555', lw * 1.6);
      fillCircle(ctx, 0.15 + sw * 0.25, -0.82, 0.17, '#FF5252', '#8E0000', lw * 0.6);
      fillCircle(ctx, 0.1 + sw * 0.25, -0.88, 0.05, '#FFFFFF');
    }
  },
  {
    id: 'scarf', tier: 'common', at: 'neck',
    paint(ctx, lw, ph, T) {
      const sw = Math.sin(ph);
      fillPolygon(ctx, [[-0.6, 0.05], [-1.35, -0.25 + sw * 0.15], [-1.4, 0.12 + sw * 0.15], [-0.65, 0.3]], T.base, T.dark, lw * 0.8);
      strokeLine(ctx, -1.25, -0.05 + sw * 0.15, -1.45, -0.02 + sw * 0.15, T.dark, lw);
      strokeCurve(ctx, -0.88, 0.02, 0, 0.32, 0.88, 0.02, T.base, 0.28);
      strokeCurve(ctx, -0.88, 0.02, 0, 0.32, 0.88, 0.02, T.light, 0.07);
    }
  },
  {
    id: 'flower', tier: 'common',
    paint(ctx, lw, ph, T) {
      ctx.save();
      ctx.translate(0.3, 0.02);
      fillEllipse(ctx, -0.4, 0.18, 0.22, 0.1, 0.5, '#4CAF50', '#2E7D32', lw * 0.5);
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 - Math.PI / 2 + Math.sin(ph) * 0.05;
        fillCircle(ctx, Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.17, T.light, T.dark, lw * 0.5);
      }
      fillCircle(ctx, 0, 0, 0.14, '#FFD54F', '#B8860B', lw * 0.5);
      ctx.restore();
    }
  },
  {
    id: 'beanie', tier: 'common',
    paint(ctx, lw, ph, T) {
      fillDome(ctx, 0, 0.25, 0.78, 0.35, T.base, T.dark, lw);
      for (const x of [-0.4, 0, 0.4]) strokeLine(ctx, x * 0.6, -0.45, x, 0.2, T.dark, lw * 0.7);
      fillRoundRect(ctx, -0.84, 0.18, 1.68, 0.32, 0.1, T.dark, T.dark, lw * 0.5);
      fillCircle(ctx, 0, -0.6, 0.2, T.light, T.dark, lw * 0.6);
    }
  },
  {
    id: 'propeller', tier: 'common',
    paint(ctx, lw, ph, T) {
      fillDome(ctx, 0, 0.25, 0.72, 0.32, T.base, T.dark, lw);
      fillPolygon(ctx, [[0, -0.47], [-0.45, 0.25], [0, 0.25]], T.light);
      fillPolygon(ctx, [[0, -0.47], [0.45, 0.25], [0, 0.25]], T.dark);
      strokeLine(ctx, 0, -0.45, 0, -0.75, '#555555', lw * 1.6);
      const spin = Math.abs(Math.cos(ph * 3));
      fillEllipse(ctx, 0, -0.8, 0.12 + 0.62 * spin, 0.08, 0, '#F5F5F5', '#666666', lw * 0.5);
      fillCircle(ctx, 0, -0.8, 0.09, '#666666');
    }
  },
  {
    id: 'headphones', tier: 'common',
    paint(ctx, lw, ph, T) {
      strokeCurve(ctx, -0.85, 0.55, 0, -0.4, 0.85, 0.55, '#333333', 0.14);
      fillEllipse(ctx, -0.9, 0.62, 0.2, 0.3, 0, T.base, '#333333', lw);
      fillEllipse(ctx, 0.9, 0.62, 0.2, 0.3, 0, T.base, '#333333', lw);
    }
  },
  {
    id: 'party', tier: 'common',
    paint(ctx, lw, ph, T) {
      ctx.save();
      ctx.translate(0.15, 0.05);
      ctx.rotate(0.25);
      fillPolygon(ctx, [[-0.5, 0.15], [0.5, 0.15], [0, -1.1]], T.base, T.dark, lw);
      ctx.save();
      fillPolygon(ctx, [[-0.5, 0.15], [0.5, 0.15], [0, -1.1]], T.base);
      ctx.clip();
      for (const y of [-0.7, -0.35, 0.0]) strokeLine(ctx, -0.6, y + 0.2, 0.6, y - 0.2, T.light, 0.12);
      ctx.restore();
      fillCircle(ctx, 0, -1.12, 0.17, T.light, T.dark, lw * 0.6);
      ctx.restore();
    }
  },
  {
    id: 'knight', tier: 'rare',
    paint(ctx, lw) {
      strokeCurve(ctx, 0, -0.45, -0.45, -0.85, -0.85, -0.55, '#E53935', 0.18);
      fillCircle(ctx, -0.85, -0.55, 0.12, '#E53935');
      fillDome(ctx, 0, 0.35, 0.8, 0.62, SILVER, SILVER_DARK, lw);
      strokeLine(ctx, -0.8, 0.62, 0.8, 0.62, SILVER_DARK, lw * 1.2);
      strokeLine(ctx, 0.2, 0.45, 0.65, 0.45, SILVER_DARK, lw * 1.4);
      strokeLine(ctx, 0.78, 0.62, 0.82, 0.95, SILVER_DARK, lw * 1.6);
      for (const x of [-0.55, -0.2, 0.15]) fillCircle(ctx, x, 0.48, 0.05, SILVER_DARK);
    }
  },
  {
    id: 'wizard', tier: 'rare',
    paint(ctx, lw, ph, T) {
      fillPolygon(ctx, [[-0.72, 0.1], [0.72, 0.1], [0.3, -0.85], [0.6, -1.25], [0.05, -1.05]], T.base, T.dark, lw);
      fillEllipse(ctx, 0, 0.1, 0.98, 0.2, 0, T.base, T.dark, lw);
      fillStar(ctx, 0.02, -0.45, 0.16, 0.07, 4, -Math.PI / 2, '#FFF176');
      fillStar(ctx, -0.3, -0.05, 0.11, 0.05, 4, -Math.PI / 2, '#FFF176');
      fillStar(ctx, 0.35, -0.15, 0.09, 0.04, 4, -Math.PI / 2, '#FFF176');
    }
  },
  {
    id: 'pirate', tier: 'rare',
    paint(ctx, lw) {
      fillPolygon(ctx, [[-1.1, 0.2], [-0.92, -0.45], [-0.3, -0.35], [0, -0.75], [0.3, -0.35], [0.92, -0.45], [1.1, 0.2]], '#2A2A2A', '#000000', lw);
      strokeLine(ctx, -1.05, 0.15, 1.05, 0.15, '#FFD54F', lw * 0.9);
      fillCircle(ctx, 0, -0.22, 0.16, '#FFFFFF');
      fillRoundRect(ctx, -0.09, -0.12, 0.18, 0.1, 0.03, '#FFFFFF');
      fillCircle(ctx, -0.05, -0.24, 0.04, '#2A2A2A');
      fillCircle(ctx, 0.06, -0.24, 0.04, '#2A2A2A');
    }
  },
  {
    id: 'chef', tier: 'rare',
    paint(ctx, lw) {
      fillCircle(ctx, -0.45, -0.35, 0.35, '#FFFFFF', '#B0B0B0', lw);
      fillCircle(ctx, 0.45, -0.35, 0.35, '#FFFFFF', '#B0B0B0', lw);
      fillCircle(ctx, 0, -0.55, 0.42, '#FFFFFF', '#B0B0B0', lw);
      fillRoundRect(ctx, -0.62, -0.15, 1.24, 0.42, 0.1, '#FFFFFF', '#B0B0B0', lw);
    }
  },
  {
    id: 'viking', tier: 'rare',
    paint(ctx, lw) {
      fillPolygon(ctx, [[-0.7, 0.2], [-1.2, -0.45], [-0.95, -0.6], [-0.5, -0.1]], '#F5F0E1', '#8D7B5A', lw);
      fillPolygon(ctx, [[0.7, 0.2], [1.2, -0.45], [0.95, -0.6], [0.5, -0.1]], '#F5F0E1', '#8D7B5A', lw);
      fillDome(ctx, 0, 0.2, 0.78, 0.45, '#9AA5B1', '#4A5560', lw);
      strokeLine(ctx, -0.78, 0.45, 0.78, 0.45, '#6D4C41', 0.14);
      strokeLine(ctx, 0, -0.58, 0, 0.4, '#4A5560', lw * 0.8);
      for (const x of [-0.5, 0.5]) fillCircle(ctx, x, 0.45, 0.05, '#3E2723');
    }
  },
  {
    id: 'tophat', tier: 'rare',
    paint(ctx, lw, ph, T) {
      fillRoundRect(ctx, -0.5, -0.95, 1.0, 1.05, 0.08, '#2B2B2B', '#000000', lw);
      strokeLine(ctx, -0.5, -0.08, 0.5, -0.08, T.base, 0.16);
      fillEllipse(ctx, 0, 0.1, 0.88, 0.16, 0, '#2B2B2B', '#000000', lw);
    }
  },
  {
    id: 'ninja', tier: 'rare', at: 'body',
    paint(ctx, lw, ph, T, P, E) {
      const sw = Math.sin(ph);
      const { x, y, s } = E.anchors.eye;
      const bx = x - 0.75;
      strokeCurve(ctx, bx, y, bx - 0.3, y - 0.2 + sw * 0.1, bx - 0.6, y - 0.05 + sw * 0.15, '#2B2B3B', 0.16);
      strokeCurve(ctx, bx, y + 0.05, bx - 0.25, y + 0.2 + sw * 0.08, bx - 0.55, y + 0.3 + sw * 0.08, '#2B2B3B', 0.16);
      strokeLine(ctx, bx, y, x + 0.55, y, '#2B2B3B', Math.max(0.6, s * 2.3));
      E.eye(ctx, x, y, s);
    }
  },
  {
    id: 'horns', tier: 'rare',
    paint(ctx, lw) {
      fillPolygon(ctx, [[-0.65, 0.3], [-1.0, -0.4], [-0.75, -0.6], [-0.3, 0.0]], '#F3E7C9', '#8D7B5A', lw);
      fillPolygon(ctx, [[0.3, 0.0], [0.7, -0.65], [0.95, -0.45], [0.65, 0.3]], '#F3E7C9', '#8D7B5A', lw);
    }
  },
  {
    id: 'crown', tier: 'epic',
    paint(ctx, lw) {
      fillPolygon(ctx, [[-0.6, 0.25], [-0.6, -0.3], [-0.3, -0.02], [0, -0.5], [0.3, -0.02], [0.6, -0.3], [0.6, 0.25]], '#FFD54F', '#B8860B', lw);
      strokeLine(ctx, -0.6, 0.12, 0.6, 0.12, '#B8860B', lw * 0.8);
      fillCircle(ctx, 0, -0.48, 0.1, '#F44336');
      fillCircle(ctx, -0.6, -0.3, 0.09, '#42A5F5');
      fillCircle(ctx, 0.6, -0.3, 0.09, '#42A5F5');
    }
  },
  {
    id: 'halo', tier: 'epic',
    paint(ctx, lw, ph) {
      const bob = Math.sin(ph) * 0.05;
      fillEllipse(ctx, 0, -0.4 + bob, 0.62, 0.17, 0, 'rgba(255, 245, 157, 0.35)');
      strokeEllipse(ctx, 0, -0.4 + bob, 0.62, 0.17, '#FFD54F', 0.12);
      strokeEllipse(ctx, 0, -0.4 + bob, 0.62, 0.17, 'rgba(255, 255, 255, 0.7)', 0.04);
    }
  },
  {
    id: 'astro', tier: 'epic',
    paint(ctx, lw) {
      fillCircle(ctx, 0, 0.88, 1.12, 'rgba(210, 240, 255, 0.3)', '#FFFFFF', lw * 2.2);
      strokeEllipse(ctx, 0, 0.88, 1.16, 1.16, '#8FB8D8', lw * 0.8);
      strokeCurve(ctx, -0.75, 0.25, -0.35, -0.2, 0.25, -0.15, 'rgba(255, 255, 255, 0.85)', lw * 1.6);
    }
  },
  {
    id: 'cape', tier: 'epic', at: 'back', layer: 'back',
    paint(ctx, lw, ph, T) {
      const sw = Math.sin(ph);
      fillPolygon(ctx, [[0.2, 0], [-0.4, -0.15], [-1.3, 0.55 + sw * 0.12], [-1.6, 1.05 + sw * 0.2], [-1.05, 1.1], [-0.6, 1.3 - sw * 0.1], [-0.05, 1.25], [0.3, 0.7]], T.base, T.dark, lw);
      strokeCurve(ctx, -0.5, 0.0, -1.0, 0.5 + sw * 0.1, -1.25, 1.0 + sw * 0.15, T.light, lw * 0.9);
    }
  }
];

// ---- Hero-only headgear -----------------------------------------------------
// Tier 'hero' keeps these out of the random generator.
HATS.push(
  {
    id: 'hood', tier: 'hero',
    paint(ctx, lw, ph, T) {
      fillPolygon(ctx, [[-0.6, -0.3], [-1.25, -0.75], [-0.8, 0.15]], T.base, T.dark, lw);
      fillDome(ctx, 0, 0.3, 0.88, 0.58, T.base, T.dark, lw);
      strokeCurve(ctx, -0.6, 0.55, 0, 0.15, 0.6, 0.55, T.dark, lw * 0.8);
    }
  },
  {
    id: 'goggles', tier: 'hero',
    paint(ctx, lw) {
      strokeCurve(ctx, -0.78, 0.42, 0, 0.18, 0.8, 0.42, '#4A2E1A', 0.16);
      fillCircle(ctx, 0.22, 0.22, 0.21, '#8FD3FF', '#4A2E1A', lw * 1.2);
      fillCircle(ctx, -0.24, 0.24, 0.19, '#8FD3FF', '#4A2E1A', lw * 1.2);
      fillCircle(ctx, 0.28, 0.15, 0.06, 'rgba(255,255,255,0.8)');
    }
  },
  {
    id: 'racehelmet', tier: 'hero',
    paint(ctx, lw, ph, T) {
      fillDome(ctx, 0, 0.5, 0.92, 0.9, T.base, T.dark, lw);
      strokeLine(ctx, 0, -0.4, 0, 0.35, T.light, 0.14);
      fillRoundRect(ctx, 0.12, 0.42, 0.9, 0.42, 0.16, 'rgba(120, 200, 255, 0.5)', '#333333', lw);
      strokeLine(ctx, 0.3, 0.52, 0.8, 0.5, 'rgba(255,255,255,0.7)', lw);
    }
  },
  {
    id: 'visor', tier: 'hero',
    paint(ctx, lw, ph, T) {
      fillDome(ctx, 0, 0.5, 0.9, 0.95, T.base, T.dark, lw);
      strokeLine(ctx, -0.55, 0.15, -0.55, 0.75, T.dark, lw * 1.2);
      fillRoundRect(ctx, 0.05, 0.45, 0.9, 0.3, 0.12, '#4DFFB0', '#1B5E3A', lw * 0.8);
      strokeLine(ctx, 0.2, 0.55, 0.75, 0.55, 'rgba(255,255,255,0.7)', lw * 0.8);
    }
  },
  {
    id: 'tiara', tier: 'hero',
    paint(ctx, lw) {
      ctx.save();
      ctx.translate(0.15, 0.05);
      fillPolygon(ctx, [[-0.42, 0.25], [-0.32, -0.12], [-0.16, 0.12], [0, -0.32], [0.16, 0.12], [0.32, -0.12], [0.42, 0.25]], '#FFD54F', '#B8860B', lw * 0.8);
      fillCircle(ctx, 0, -0.05, 0.08, '#FF80AB');
      ctx.restore();
    }
  },
  {
    id: 'mushroom', tier: 'hero',
    paint(ctx, lw, ph, T) {
      fillEllipse(ctx, 0, 0.05, 1.15, 0.58, 0, T.base, T.dark, lw);
      fillEllipse(ctx, -0.5, -0.05, 0.2, 0.17, 0, '#FFF8E7');
      fillEllipse(ctx, 0.2, -0.25, 0.22, 0.18, 0, '#FFF8E7');
      fillEllipse(ctx, 0.72, 0.15, 0.15, 0.12, 0, '#FFF8E7');
      fillEllipse(ctx, 0, 0.55, 1.05, 0.12, 0, T.dark);
    }
  }
);

// ---- Props ------------------------------------------------------------------
// Hand-held items and outfits, painted in body space. `back` props go behind
// the body, the rest go over it (before headgear).
const WOOD = '#8B5A2B';
const STEEL = '#8A8F98';

const PROPS = {
  mustache: {
    paint(ctx, lw) {
      fillEllipse(ctx, 0.6, 0.42, 0.26, 0.11, -0.35, '#4A2E1A', '#2B1A0E', lw * 0.4);
      fillEllipse(ctx, 1.02, 0.42, 0.26, 0.11, 0.35, '#4A2E1A', '#2B1A0E', lw * 0.4);
    }
  },
  necktie: {
    paint(ctx, lw, ph, T) {
      fillPolygon(ctx, [[0.3, 0.2], [0.45, 0.32], [0.36, 0.78], [0.2, 0.32]], T.base, T.dark, lw * 0.6);
      fillPolygon(ctx, [[0.22, 0.14], [0.42, 0.14], [0.36, 0.26], [0.28, 0.26]], T.dark);
    }
  },
  wrench: {
    paint(ctx, lw) {
      strokeLine(ctx, 0.2, 0.95, 0.85, 0.62, STEEL, 0.13);
      ctx.save();
      ctx.translate(0.95, 0.58);
      ctx.rotate(-1.1);
      fillRoundRect(ctx, -0.16, -0.2, 0.32, 0.36, 0.08, STEEL, '#4A5058', lw * 0.6);
      fillRoundRect(ctx, -0.07, -0.26, 0.14, 0.2, 0.03, '#A6DCFF');
      ctx.restore();
    }
  },
  mallet: {
    paint(ctx, lw) {
      strokeLine(ctx, 0.35, 0.8, 1.0, 0.05, WOOD, 0.11);
      ctx.save();
      ctx.translate(1.0, 0.05);
      ctx.rotate(0.85);
      fillRoundRect(ctx, -0.28, -0.16, 0.56, 0.32, 0.07, '#6D6D6D', '#333333', lw * 0.7);
      ctx.restore();
    }
  },
  gloves: {
    paint(ctx, lw, ph, T) {
      const sw = Math.sin(ph);
      fillCircle(ctx, 0.3, 0.75, 0.22, T.base, T.dark, lw * 0.8);
      fillCircle(ctx, 0.85, 0.45 - sw * 0.08, 0.26, T.base, T.dark, lw * 0.8);
      strokeCurve(ctx, 0.72, 0.4 - sw * 0.08, 0.85, 0.3 - sw * 0.08, 0.98, 0.4 - sw * 0.08, T.dark, lw * 0.6);
    }
  },
  bow: {
    paint(ctx, lw) {
      ctx.beginPath();
      ctx.arc(0.85, 0.3, 0.6, -1.25, 1.25);
      ctx.strokeStyle = WOOD; ctx.lineWidth = 0.09; ctx.lineCap = 'round'; ctx.stroke();
      strokeLine(ctx, 1.04, -0.27, 1.04, 0.87, '#EEEEEE', lw * 0.6);
      strokeLine(ctx, 0.55, 0.3, 1.35, 0.3, '#DDD3B0', lw * 0.8);
      fillPolygon(ctx, [[1.35, 0.22], [1.5, 0.3], [1.35, 0.38]], STEEL);
    }
  },
  swordshield: {
    paint(ctx, lw, ph, T) {
      strokeLine(ctx, 0.75, 0.75, 1.3, 0.05, '#DDE3EA', 0.1);
      strokeLine(ctx, 0.75, 0.75, 1.3, 0.05, '#5A6675', lw * 0.4);
      strokeLine(ctx, 0.78, 0.55, 0.98, 0.72, '#B8860B', 0.09);
      fillEllipse(ctx, 0.05, 0.55, 0.3, 0.38, 0, T.base, STEEL, 0.08);
      strokeLine(ctx, 0.05, 0.25, 0.05, 0.85, T.light, lw * 0.9);
    }
  },
  fairywings: {
    back: true,
    paint(ctx, lw, ph) {
      const flap = Math.sin(ph * 2.5) * 0.15;
      fillEllipse(ctx, -0.6, -0.6, 0.6, 0.32, -0.7 + flap, 'rgba(255, 255, 255, 0.65)', 'rgba(255, 255, 255, 0.95)', lw * 0.7);
      fillEllipse(ctx, -0.65, 0.15, 0.48, 0.26, 0.45 - flap, 'rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.95)', lw * 0.7);
    }
  },
  shell: {
    back: true,
    paint(ctx, lw, ph, T) {
      const cx = -0.45, cy = -0.2;
      for (let a = 1.75; a < 4.9; a += 0.55) {
        const x = cx + Math.cos(a) * 0.85, y = cy + Math.sin(a) * 0.75;
        fillPolygon(ctx, [[x + Math.cos(a + 1.4) * 0.16, y + Math.sin(a + 1.4) * 0.16], [cx + Math.cos(a) * 1.2, cy + Math.sin(a) * 1.05], [x + Math.cos(a - 1.4) * 0.16, y + Math.sin(a - 1.4) * 0.16]], '#F3E7C9', '#8D7B5A', lw * 0.6);
      }
      fillEllipse(ctx, cx, cy, 0.88, 0.78, 0, T.base, T.dark, lw);
      strokeEllipse(ctx, cx, cy, 0.6, 0.5, T.dark, lw * 0.8);
    }
  },
  overalls: {
    paint(ctx, lw, ph, T) {
      strokeLine(ctx, 0.15, 0.2, -0.05, -0.35, T.base, 0.1);
      strokeLine(ctx, 0.55, 0.2, 0.45, -0.4, T.base, 0.1);
      fillRoundRect(ctx, 0.02, 0.15, 0.62, 0.52, 0.1, T.base, T.dark, lw * 0.6);
      fillCircle(ctx, 0.15, 0.25, 0.05, '#FFD54F');
      fillCircle(ctx, 0.52, 0.25, 0.05, '#FFD54F');
      strokeLine(ctx, 0.2, 0.45, 0.48, 0.45, T.dark, lw * 0.6);
    }
  },
  gown: {
    paint(ctx, lw, ph, T) {
      fillPolygon(ctx, [[-0.7, 0.4], [0.72, 0.4], [1.05, 1.1], [-1.05, 1.1]], T.base, T.dark, lw);
      strokeLine(ctx, -0.95, 0.95, 0.95, 0.95, T.light, lw * 1.2);
      strokeCurve(ctx, -0.6, 0.42, 0, 0.6, 0.62, 0.42, T.light, lw * 0.8);
    }
  },
  lightningtail: {
    back: true,
    paint(ctx, lw, ph) {
      const sw = Math.sin(ph) * 0.08;
      fillPolygon(ctx, [[-0.8, 0.15], [-1.1, -0.15 + sw], [-0.98, -0.22 + sw], [-1.4, -0.7 + sw], [-1.58, -0.6 + sw], [-1.22, -0.1 + sw], [-1.38, 0.0 + sw], [-0.8, 0.4]], '#FFD54F', '#B8860B', lw * 0.8);
    }
  },
  staff: {
    paint(ctx, lw, ph, T) {
      strokeLine(ctx, 0.6, 0.9, 0.98, -0.6, WOOD, 0.1);
      fillCircle(ctx, 1.02, -0.72, 0.2, 'rgba(255, 255, 255, 0.35)');
      fillCircle(ctx, 1.02, -0.72, 0.14, T.light, T.dark, lw * 0.6);
    }
  },
  wheel: {
    paint(ctx, lw) {
      strokeEllipse(ctx, 0.8, 0.5, 0.3, 0.3, '#333333', 0.1);
      strokeLine(ctx, 0.8, 0.22, 0.8, 0.78, '#333333', lw * 0.8);
      strokeLine(ctx, 0.52, 0.5, 1.08, 0.5, '#333333', lw * 0.8);
      fillCircle(ctx, 0.8, 0.5, 0.07, '#333333');
    }
  }
};

// ---- Retro Heroes ----------------------------------------------------------------
// Original takes on classic console archetypes: no trademarked names, emblems
// or copied signature designs. Each entry is fixed data, so ids never move.
const HEROES = [
  { name: 'Gus Fixit', rarity: 'epic', base: 'bear', palette: 'sunny', hat: 'cap', tint: 'teal', props: ['overalls', 'mustache', 'wrench'], eyes: 'round' },
  { name: 'Wanda Wrenchly', rarity: 'rare', base: 'pig', palette: 'lime', hat: 'beanie', tint: 'purple', props: ['overalls', 'wrench'], eyes: 'round' },
  { name: 'Fern Quiverleaf', rarity: 'epic', base: 'rabbit', palette: 'forest', hat: 'hood', tint: 'green', props: ['bow'], eyes: 'round' },
  { name: 'Zapper Volt', rarity: 'rare', base: 'mouse', palette: 'ocean', hat: 'none', tint: 'yellow', props: ['lightningtail'], eyes: 'round', extra: 'blush' },
  { name: 'Puffle Plum', rarity: 'rare', base: 'slime', palette: 'lavender', hat: 'bow', tint: 'pink', props: [], eyes: 'round', extra: 'blush' },
  { name: 'Mango Chestthump', rarity: 'rare', base: 'bear', palette: 'cocoa', hat: 'none', tint: 'blue', props: ['necktie'], eyes: 'bead' },
  { name: 'Princess Petunia Pufftail', rarity: 'epic', base: 'rabbit', palette: 'bubblegum', hat: 'tiara', tint: 'purple', props: ['gown'], eyes: 'round', extra: 'sparkle' },
  { name: 'Grumbleshell', rarity: 'epic', base: 'dragon', palette: 'forest', hat: 'none', tint: 'purple', props: ['shell'], eyes: 'round' },
  { name: 'Morel Capwell', rarity: 'rare', base: 'slime', palette: 'cream', hat: 'mushroom', tint: 'blue', props: [], eyes: 'bead' },
  { name: 'Ace Emberpaw', rarity: 'epic', base: 'fox', palette: 'cherry', hat: 'goggles', tint: 'blue', props: [], eyes: 'round' },
  { name: 'Vega Starhunter', rarity: 'epic', base: 'bear', palette: 'grape', hat: 'visor', tint: 'purple', props: [], eyes: 'round', extra: 'sparkle' },
  { name: 'Mint Munchasaurus', rarity: 'rare', base: 'dragon', palette: 'mint', hat: 'none', tint: 'red', props: [], eyes: 'round', extra: 'blush' },
  { name: 'Giggles Sheetwick', rarity: 'rare', base: 'ghost', palette: 'cherry', hat: 'sunglasses', tint: 'red', props: [], eyes: 'round' },
  { name: 'Bashful Peekwick', rarity: 'rare', base: 'ghost', palette: 'cream', hat: 'none', tint: 'pink', props: [], eyes: 'happy', extra: 'blush' },
  { name: 'Tundra Mallory', rarity: 'rare', base: 'penguin', palette: 'sky', hat: 'beanie', tint: 'red', props: ['mallet'], eyes: 'round' },
  { name: 'Rocco Jabsworth', rarity: 'rare', base: 'dog', palette: 'cocoa', hat: 'headband', tint: 'red', props: ['gloves'], eyes: 'round' },
  { name: 'Turbo Trotter', rarity: 'rare', base: 'pig', palette: 'cherry', hat: 'racehelmet', tint: 'blue', props: ['wheel'], eyes: 'round' },
  { name: 'Twinkle Dewwing', rarity: 'epic', base: 'slime', palette: 'mint', hat: 'flower', tint: 'pink', props: ['fairywings'], eyes: 'round', extra: 'sparkle' },
  { name: 'Sir Waddleston', rarity: 'epic', base: 'penguin', palette: 'midnight', hat: 'knight', tint: 'blue', props: ['swordshield'], eyes: 'round' },
  { name: 'Bolt Beepsworth', rarity: 'rare', base: 'robot', palette: 'slate', hat: 'propeller', tint: 'orange', props: [], eyes: 'round' },
  { name: 'Lumen Moonwhisker', rarity: 'epic', base: 'star', palette: 'cream', hat: 'wizard', tint: 'purple', props: ['staff'], eyes: 'happy', extra: 'sparkle' },
  { name: 'Ricochet Rex', rarity: 'rare', base: 'dog', palette: 'tangerine', hat: 'headband', tint: 'blue', props: [], eyes: 'round', extra: 'stripes' },
  { name: 'Dash Quillfoot', rarity: 'rare', base: 'cat', palette: 'ocean', hat: 'sunglasses', tint: 'red', props: [], eyes: 'round' },
  { name: 'Sparkwing Ember', rarity: 'rare', base: 'dragon', palette: 'lavender', hat: 'none', tint: 'orange', props: [], eyes: 'round' },
  { name: 'Captain Wispbeard', rarity: 'rare', base: 'ghost', palette: 'slate', hat: 'pirate', tint: 'red', props: ['swordshield'], eyes: 'round' },
  { name: 'Commander Bruin', rarity: 'epic', base: 'bear', palette: 'cream', hat: 'astro', tint: 'orange', props: [], eyes: 'round', extra: 'sparkle' },
  { name: 'Kunai Purrsley', rarity: 'rare', base: 'cat', palette: 'midnight', hat: 'ninja', tint: 'red', props: [], eyes: 'round' },
  { name: 'Chef Flapjack', rarity: 'rare', base: 'penguin', palette: 'slate', hat: 'chef', tint: 'red', props: [], eyes: 'round', extra: 'blush' },
  { name: 'Bjorn Frostmane', rarity: 'rare', base: 'bear', palette: 'slate', hat: 'viking', tint: 'red', props: ['mallet'], eyes: 'round' },
  { name: 'Master Squeakwan', rarity: 'rare', base: 'mouse', palette: 'cream', hat: 'headband', tint: 'orange', props: ['staff'], eyes: 'happy' },
  { name: 'Digger Boondock', rarity: 'rare', base: 'dog', palette: 'cream', hat: 'goggles', tint: 'green', props: [], eyes: 'round', extra: 'spots' },
  { name: 'Porkchop Skyrider', rarity: 'rare', base: 'pig', palette: 'sky', hat: 'propeller', tint: 'red', props: [], eyes: 'round' },
  { name: 'Prickles Von Spike', rarity: 'rare', base: 'cactus', palette: 'forest', hat: 'tophat', tint: 'red', props: ['mustache'], eyes: 'round' },
  { name: 'Gloop Xandar', rarity: 'rare', base: 'slime', palette: 'lime', hat: 'antenna', tint: 'purple', props: [], eyes: 'bead' },
  { name: 'Queen Buzzabella', rarity: 'epic', base: 'bug', palette: 'sunny', hat: 'crown', tint: 'purple', props: [], eyes: 'round', extra: 'sparkle' },
  { name: 'Sage Hootspell', rarity: 'epic', base: 'owl', palette: 'grape', hat: 'wizard', tint: 'blue', props: ['staff'], eyes: 'round' },
  { name: 'DJ Inkwell', rarity: 'rare', base: 'octopus', palette: 'ocean', hat: 'headphones', tint: 'orange', props: [], eyes: 'round' },
  { name: 'Captain Twinkleton', rarity: 'epic', base: 'star', palette: 'sunny', hat: 'none', tint: 'red', props: [], eyes: 'round', extra: 'sparkle', cape: true },
  { name: 'Sparrow Hoodwink', rarity: 'rare', base: 'bird', palette: 'cocoa', hat: 'hood', tint: 'green', props: ['bow'], eyes: 'round' },
  { name: 'Piston Punchbot', rarity: 'rare', base: 'robot', palette: 'cherry', hat: 'headband', tint: 'blue', props: ['gloves'], eyes: 'round' },
  { name: 'Rexley Vroom', rarity: 'rare', base: 'dragon', palette: 'lime', hat: 'racehelmet', tint: 'red', props: ['wheel'], eyes: 'round' }
];

function byId(list, id, what) {
  const found = list.find(x => x.id === id);
  if (!found) throw new Error(`avatars: unknown ${what} '${id}'`);
  return found;
}

function buildHero(h) {
  const base = byId(BASES, h.base, 'base');
  const palette = byId(PALETTES, h.palette, 'palette');
  const hat = byId(HATS, h.hat, 'hat');
  const tint = TINTS.find(t => t.family === h.tint);
  if (!tint) throw new Error(`avatars: unknown tint '${h.tint}'`);
  const props = (h.props || []).map(p => {
    if (!PROPS[p]) throw new Error(`avatars: unknown prop '${p}'`);
    return PROPS[p];
  });
  const c = { base, palette, hat, tint, eyes: h.eyes || 'round', extra: h.extra || 'none', props, cape: h.cape ? byId(HATS, 'cape', 'hat') : null };
  return {
    id: kebab(h.name), name: h.name, rarity: h.rarity, set: 'retro-heroes',
    base: base.id, palette: palette.id, hat: hat.id,
    draw: character((ctx, lw, phase) => paintCharacter(ctx, lw, phase, c))
  };
}

// ---- Composition ------------------------------------------------------------
function paintHat(ctx, lw, phase, hat, T, P, base, E) {
  const a = hat.at === 'body' ? { x: 0, y: 0, s: 1 } : base.anchors[hat.at || 'head'];
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.scale(a.s, a.s);
  hat.paint(ctx, lw / a.s, phase, T, P, E);
  ctx.restore();
}

function paintCharacter(ctx, lw, phase, c) {
  const { base, palette: P, hat, tint: T } = c;
  const E = {
    hat: hat.id,
    anchors: base.anchors,
    eye: makeEye(c.eyes, P),
    decor: base.noDecor ? () => {} : (cx) => drawDecor(cx, lw, c.extra, P)
  };
  const props = c.props || [];
  if (c.cape) paintHat(ctx, lw, phase, c.cape, T, P, base, E);
  if (hat.layer === 'back') paintHat(ctx, lw, phase, hat, T, P, base, E);
  for (const p of props) if (p.back) p.paint(ctx, lw, phase, T, P);
  base.paint(ctx, lw, phase, P, E);
  for (const p of props) if (!p.back) p.paint(ctx, lw, phase, T, P);
  if (hat.layer !== 'back') paintHat(ctx, lw, phase, hat, T, P, base, E);
  if (c.extra === 'sparkle') drawSparkles(ctx, phase);
}

// ---- Names ------------------------------------------------------------------
const FIRST_NAMES = [
  'Pixel', 'Bubbles', 'Luna', 'Pounce', 'Ziggy', 'Momo', 'Pip', 'Nova', 'Biscuit', 'Waffle',
  'Pepper', 'Sprout', 'Juno', 'Tofu', 'Mango', 'Kiwi', 'Rocket', 'Dizzy', 'Bolt', 'Ember',
  'Frosty', 'Noodle', 'Pickle', 'Gizmo', 'Nibbles', 'Peaches', 'Clover', 'Doodle', 'Fizz', 'Bonbon',
  'Cocoa', 'Pudding', 'Marble', 'Sunny', 'Breezy', 'Ollie', 'Wiggles', 'Squeak', 'Toby', 'Milo',
  'Rosie', 'Hazel', 'Poppy', 'Ruby', 'Jasper', 'Otto', 'Willow', 'Felix', 'Maple', 'Pebble',
  'Twinkle', 'Zippy', 'Bumble', 'Snowy', 'Dash', 'Blip', 'Jelly', 'Muffin', 'Sprinkle', 'Tango',
  'Wobble', 'Boop', 'Fudge', 'Comet', 'Nutmeg', 'Puff', 'Tuffy', 'Blossom', 'Skip', 'Rumble',
  'Ginger', 'Pinto', 'Pippin', 'Taco', 'Zuzu', 'Bingo', 'Lolly', 'Widget', 'Sparky', 'Scooter',
  'Wren', 'Ivy', 'Moss', 'Bean', 'Ripple', 'Quill', 'Nimbus', 'Tinker', 'Pogo', 'Flick'
];

const SURNAMES = [
  'Frostpaw', 'Whiskerton', 'Bumblebottom', 'Puddlejump', 'Sparkletail', 'Thunderhoof', 'Mossyfoot',
  'Jellybean', 'Snugglesworth', 'Featherfluff', 'Brightwing', 'Stormbeard', 'Goldscale', 'Quickfin',
  'Mooncheek', 'Honeydew', 'Cloudhopper', 'Starwhisker', 'Pebblenose', 'Wigglesby', 'Bubblefin',
  'Tinkerbolt', 'Fizzlepop', 'Sugarplum', 'Rainbowtail', 'Marshmallow', 'Dewdrop', 'Twinklefoot',
  'Copperclaw', 'Silverbeak', 'Velvetpaw', 'Snowdrift', 'Sunbeam', 'Cinnamon', 'Peppercorn',
  'Glimmerhorn', 'Wobblekins', 'Dandelion', 'Buttercup', 'Nightsky'
];

const ADJECTIVES = [
  'Brave', 'Sleepy', 'Speedy', 'Mighty', 'Jolly', 'Tiny', 'Clever', 'Fluffy', 'Bouncy', 'Sneaky',
  'Sparkly', 'Grumpy', 'Cheeky', 'Gentle', 'Wild', 'Lucky', 'Dizzy', 'Cosmic'
];

const HAT_TITLES = {
  crown: ['King', 'Queen', 'Prince', 'Princess'],
  knight: ['Sir', 'Dame'],
  wizard: ['Wizard', 'Mage'],
  pirate: ['Captain', 'Admiral'],
  chef: ['Chef', 'Baker'],
  astro: ['Astro', 'Commander', 'Major'],
  viking: ['Chief', 'Viking'],
  tophat: ['Mister', 'Lady', 'Baron'],
  ninja: ['Ninja', 'Shadow'],
  halo: ['Angel', 'Saint'],
  cape: ['Super', 'Mighty'],
  horns: ['Little', 'Wild'],
  headphones: ['DJ'],
  propeller: ['Pilot'],
  party: ['Party']
};

function makeName(rng, rarity, base, hat, used) {
  const titles = HAT_TITLES[hat.id];
  for (let attempt = 0; attempt < 60; attempt++) {
    const first = pick(rng, FIRST_NAMES);
    const roll = rng();
    let name;
    if (titles && roll < 0.7) {
      const title = pick(rng, titles);
      name = rarity === 'common' ? `${title} ${first}` : `${title} ${first} ${pick(rng, SURNAMES)}`;
    } else if (roll < 0.35) {
      name = `${first} the ${base.species}`;
    } else if (roll < 0.75) {
      name = `${first} ${pick(rng, SURNAMES)}`;
    } else {
      name = `${first} the ${pick(rng, ADJECTIVES)} ${base.species}`;
    }
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  throw new Error('avatars: could not generate a unique character name');
}

function kebab(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ---- Roster generation --------------------------------------------------------
export const STARTER_IDS = ['bird', 'cat', 'frog', 'penguin', 'owl', 'fox', 'panda', 'rabbit'];

const GENERATED_COUNT = 242;
const EPIC_COUNT = 12;
const RARE_COUNT = 36;
const ROSTER_SEED = 20260916;

// The generated crowd. Its output is part of the persisted-id contract: never
// change the seed, the counts, or the order of rng calls below.
function generateRoster() {
  const rng = mulberry32(ROSTER_SEED);
  const rarities = shuffle([
    ...Array(EPIC_COUNT).fill('epic'),
    ...Array(RARE_COUNT).fill('rare'),
    ...Array(GENERATED_COUNT - EPIC_COUNT - RARE_COUNT).fill('common')
  ], rng);
  const usedPairs = new Set();
  const usedTriples = new Set();
  const usedNames = new Set();
  const usedIds = new Set(STARTER_IDS);
  const roster = [];

  for (let i = 0; i < GENERATED_COUNT; i++) {
    const base = BASES[i % BASES.length];
    const rarity = rarities[i];
    const palettes = PALETTES.filter(p => !usedPairs.has(base.id + '/' + p.id));
    if (palettes.length === 0) throw new Error('avatars: ran out of palettes for ' + base.id);
    const palette = pick(rng, palettes);
    usedPairs.add(base.id + '/' + palette.id);

    const hats = HATS.filter(h => h.tier === rarity && !(base.noHats || []).includes(h.id));
    const hat = pick(rng, hats);
    const triple = `${base.id}/${palette.id}/${hat.id}`;
    if (usedTriples.has(triple)) throw new Error('avatars: duplicate character ' + triple);
    usedTriples.add(triple);

    const tint = pick(rng, TINTS.filter(t => t.family !== palette.family));
    const eyes = pick(rng, ['round', 'round', 'round', 'bead', 'happy']);
    const extra = rarity === 'epic' ? 'sparkle' : pick(rng, ['none', 'none', 'spots', 'stripes', 'blush', 'freckles']);
    const name = makeName(rng, rarity, base, hat, usedNames);
    const id = kebab(name);
    if (usedIds.has(id)) throw new Error('avatars: duplicate character id ' + id);
    usedIds.add(id);

    const c = { base, palette, hat, tint, eyes, extra };
    roster.push({
      id, name, rarity,
      base: base.id, palette: palette.id, hat: hat.id,
      draw: character((ctx, lw, phase) => paintCharacter(ctx, lw, phase, c))
    });
  }
  return roster;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Wraps a unit-space painter so callers get the draw(ctx, r, phase) contract.
function character(paint) {
  return function draw(ctx, r, phase = 0) {
    ctx.save();
    ctx.scale(r, r);
    ctx.lineJoin = 'round';
    paint(ctx, 1.5 / r, phase);
    ctx.restore();
  };
}

const STARTERS = [
  { id: 'bird',    name: 'Bird',    base: 'bird', rarity: 'common', draw: character(drawBird) },
  { id: 'cat',     name: 'Cat',     base: 'cat', rarity: 'common', draw: character(drawCat) },
  { id: 'frog',    name: 'Frog',    base: 'frog', rarity: 'common', draw: character(drawFrog) },
  { id: 'penguin', name: 'Penguin', base: 'penguin', rarity: 'common', draw: character(drawPenguin) },
  { id: 'owl',     name: 'Owl',     base: 'owl', rarity: 'common', draw: character(drawOwl) },
  { id: 'fox',     name: 'Fox',     base: 'fox', rarity: 'common', draw: character(drawFox) },
  { id: 'panda',   name: 'Panda',   base: 'bear', rarity: 'common', draw: character(drawPanda) },
  { id: 'rabbit',  name: 'Rabbit',  base: 'rabbit', rarity: 'common', draw: character(drawRabbit) }
];

// Order matters: starters, then the generated crowd, then the hero set. Ids
// are persisted, so new characters are only ever appended.
const HERO_AVATARS = HEROES.map(buildHero);

export const AVATARS = [...STARTERS, ...generateRoster(), ...HERO_AVATARS];

const TRIPLES = new Set();
const DUPLICATE_LOOKS = [];
for (const a of AVATARS) {
  if (!a.palette) continue;
  const triple = `${a.base}/${a.palette}/${a.hat}`;
  if (TRIPLES.has(triple)) DUPLICATE_LOOKS.push(triple);
  TRIPLES.add(triple);
}
if (DUPLICATE_LOOKS.length) throw new Error('avatars: duplicate character looks: ' + DUPLICATE_LOOKS.join(', '));

const AVATAR_BY_ID = new Map(AVATARS.map(a => [a.id, a]));
if (AVATAR_BY_ID.size !== AVATARS.length) throw new Error('avatars: duplicate ids in roster');
if (new Set(AVATARS.map(a => a.name)).size !== AVATARS.length) throw new Error('avatars: duplicate names in roster');

export const DEFAULT_AVATAR_ID = 'bird';

export function getAvatar(id) {
  return AVATAR_BY_ID.get(id) || AVATAR_BY_ID.get(DEFAULT_AVATAR_ID);
}

export function drawAvatar(ctx, id, r, phase = 0) {
  getAvatar(id).draw(ctx, r, phase);
}
