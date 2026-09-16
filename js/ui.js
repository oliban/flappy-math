// Shared canvas UI helpers: palette, fonts, shapes, buttons and hit areas.

export const FONT = "'Fredoka', 'Nunito', system-ui, -apple-system, sans-serif";

export const COLORS = {
  ink: '#1F2A44',
  inkSoft: '#5B6685',
  card: 'rgba(255, 255, 255, 0.94)',
  cardShadow: 'rgba(31, 42, 68, 0.18)',
  primary: '#FF8A3D',
  primaryDark: '#E0702A',
  secondary: '#4F86F7',
  secondaryDark: '#3A6BD6',
  success: '#43B76A',
  successDark: '#2E9A54',
  danger: '#EF5A5A',
  gold: '#FFC93C',
  goldDark: '#E0AA1F',
  muted: '#EEF1F8',
  mutedBorder: '#D7DCE8'
};

// Font strings are cached: Safari re-parses the font shorthand on every assignment.
const fontCache = new Map();
export function font(size, weight = 'normal') {
  const key = `${weight}|${Math.round(size)}`;
  let f = fontCache.get(key);
  if (!f) {
    f = `${weight} ${Math.round(size)}px ${FONT}`;
    fontCache.set(key, f);
  }
  return f;
}

// Vector heart (emoji glyphs are slow to rasterize on mobile Safari)
export function drawHeart(ctx, x, y, size, color) {
  const s = size / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.2, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.2, x, y + s * 0.9);
  ctx.closePath();
  ctx.fill();
}

// Emoji glyphs ignore weight; keep them on the same font stack for consistent metrics.
export function emojiFont(size) {
  return font(size, '');
}

export function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawCard(ctx, x, y, width, height, { radius = 20, fill = COLORS.card, shadow = true } = {}) {
  if (shadow) {
    ctx.fillStyle = COLORS.cardShadow;
    roundRect(ctx, x, y + 6, width, height, radius);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
}

// Chunky button with a darker "3D" base. Returns its rect for hit testing.
export function drawButton(ctx, x, y, width, height, label, {
  color = COLORS.primary, dark = COLORS.primaryDark, textColor = '#FFF', fontSize = 22, icon = null
} = {}) {
  const radius = Math.min(16, height / 2);
  ctx.fillStyle = dark;
  roundRect(ctx, x, y + 4, width, height, radius);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, height - 2, radius);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = icon ? `${icon}  ${label}` : label;
  ctx.font = font(fontSize, '600');
  ctx.fillText(text, x + width / 2, y + height / 2 - 1);
  ctx.textBaseline = 'alphabetic';
  return { x, y, width, height };
}

// Text with a soft drop shadow, used for titles.
export function drawTitle(ctx, text, x, y, size, color = '#FFF') {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(size, '700');
  ctx.fillStyle = 'rgba(31, 42, 68, 0.28)';
  ctx.fillText(text, x, y + Math.max(3, size * 0.06));
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// Registry of clickable regions, rebuilt every frame by the render pass so
// click handling can never drift from what is drawn.
export function createHitAreas() {
  let areas = [];
  return {
    clear() { areas = []; },
    add(rect, action) { areas.push({ ...rect, action }); },
    hit(x, y) {
      for (let i = areas.length - 1; i >= 0; i--) {
        const a = areas[i];
        if (x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height) {
          return a.action;
        }
      }
      return null;
    }
  };
}
