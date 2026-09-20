// Escalating reward effects for correct answers.
//
// The ladder is driven by the player's streak: answer one right and you get a
// small puff, keep going and it grows through sparkles, shockwaves, jets and a
// fountain until the top tier sets off real fireworks. A wrong answer resets
// the streak, so the climb starts over.
//
// Everything here is plain state plus a compact renderer - the tests cover the
// tier ladder and the particle physics, never the canvas.

const TAU = Math.PI * 2;

export const EFFECT_COLORS = [
  '#FFC42E', '#FF7A1F', '#FF3D6E', '#FF3D9A',
  '#6C4CFF', '#17B8E8', '#22C55E', '#FFFFFF'
];

// Firework shells pick from the deepest of those, so a burst stays crisp
// against a pale sky as well as a night one.
const SHELL_COLORS = ['#FFC42E', '#FF3D9A', '#17B8E8', '#22C55E', '#FF7A1F'];

export const MAX_TIER = 7;

// Hard ceilings so a long streak at speed 99 can never drown a phone
export const MAX_PARTICLES = 420;
const MAX_RINGS = 16;
const MAX_SHELLS = 12;

const FADE_FRAMES = 14;      // alpha ramp at the end of a particle's life
const EXTINGUISH_LIFE = 12;  // how fast a broken streak snuffs the leftovers

// Per-kind physics. Sparks arc and fall, stars hang and twinkle, trails die fast.
const KINDS = {
  spark: { gravity: 0.055, drag: 0.958 },
  star:  { gravity: 0.008, drag: 0.930 },
  trail: { gravity: 0.020, drag: 0.900 }
};

/**
 * The tier ladder. Each step keeps what the one below it had and adds
 * something new, so the climb is visible rather than a swap of looks.
 *  1 puff       - a tiny spark puff at the bird
 *  2 sparkle    - puff plus twinkling stars
 *  3 shockwave  - plus an expanding ring
 *  4 jets       - plus spark jets from the bottom corners
 *  5 fountain   - plus a sparkler fountain under the bird
 *  6 firework   - plus one shell that launches and bursts in the sky
 *  7 finale     - three staggered shells with secondary crackle bursts
 */
const SPECS = [
  { name: 'puff',      confetti: 10, sparks: 12, stars: 0,  rings: 0, jets: 0, fountain: 0, shells: 0, secondary: false },
  { name: 'sparkle',   confetti: 16, sparks: 16, stars: 8,  rings: 0, jets: 0, fountain: 0, shells: 0, secondary: false },
  { name: 'shockwave', confetti: 22, sparks: 22, stars: 10, rings: 1, jets: 0, fountain: 0, shells: 0, secondary: false },
  { name: 'jets',      confetti: 28, sparks: 26, stars: 12, rings: 2, jets: 2, fountain: 0, shells: 0, secondary: false },
  { name: 'fountain',  confetti: 34, sparks: 30, stars: 14, rings: 2, jets: 2, fountain: 1, shells: 0, secondary: false },
  { name: 'firework',  confetti: 38, sparks: 32, stars: 16, rings: 3, jets: 2, fountain: 1, shells: 1, secondary: false },
  { name: 'finale',    confetti: 46, sparks: 36, stars: 20, rings: 3, jets: 2, fountain: 2, shells: 3, secondary: true }
].map(spec => Object.freeze({
  ...spec,
  // A single number for "how big is this one" - used to keep the ladder honest.
  weight: spec.confetti + spec.sparks + spec.stars +
          spec.jets * 14 + spec.fountain * 24 + spec.rings * 8 + spec.shells * 60
}));

/** Which tier a streak earns. One tier per consecutive correct answer, capped. */
export function tierForStreak(streak) {
  if (!(streak > 0)) return 0;
  return Math.min(Math.floor(streak), MAX_TIER);
}

/** The recipe for a tier (clamped to the top); null when there is no effect. */
export function tierSpec(tier) {
  if (!(tier > 0)) return null;
  return SPECS[Math.min(Math.floor(tier), MAX_TIER) - 1];
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function createEffects() {
  let particles = [];
  let rings = [];
  let shells = [];
  let explosions = 0;   // how many shells have burst, for tests and sound hooks

  function addParticle(p) {
    particles.push(p);
    if (particles.length > MAX_PARTICLES) {
      // Keep the newest: an older burst is already fading out anyway.
      particles = particles.slice(particles.length - MAX_PARTICLES);
    }
  }

  function spawn({ x, y, kind = 'spark', angle, spread, speed, life, size, color }) {
    const dir = angle + rand(-spread / 2, spread / 2);
    const v = speed * rand(0.5, 1.15);
    addParticle({
      x, y, kind,
      vx: Math.cos(dir) * v,
      vy: Math.sin(dir) * v,
      size,
      color: color || pick(EFFECT_COLORS),
      life,
      age: 0,
      alpha: 1,
      phase: rand(0, TAU)
    });
  }

  function addRing({ x, y, radius = 6, growth = 3.4, life = 26, color = '#FFB200', width = 7 }) {
    rings.push({ x, y, radius, growth, life, age: 0, alpha: 1, color, width });
    if (rings.length > MAX_RINGS) rings = rings.slice(rings.length - MAX_RINGS);
  }

  function addShell(shell) {
    shells.push(shell);
    if (shells.length > MAX_SHELLS) shells = shells.slice(shells.length - MAX_SHELLS);
  }

  // A shell bursting: a flash ring, a sphere of sparks, and for the finale a
  // couple of small crackles that go off a moment later.
  function explode(shell) {
    explosions++;
    const scale = shell.scale;
    const count = shell.burstCount;
    // A hot core flash, then the expanding shock ring around it
    addRing({
      x: shell.x, y: shell.y,
      radius: 3, growth: 1.1 / scale,
      life: 9 * scale, color: '#FFFFFF', width: 18
    });
    addRing({
      x: shell.x, y: shell.y,
      radius: 4, growth: 3.8 / scale,
      life: 26 * scale, color: shell.color, width: 8
    });

    for (let i = 0; i < count; i++) {
      // Even angular spread with jitter gives a round burst instead of a blob
      const angle = (i / count) * TAU + rand(-0.12, 0.12);
      spawn({
        x: shell.x, y: shell.y, kind: 'spark',
        angle, spread: 0,
        speed: shell.burstSpeed,
        life: shell.burstLife,
        size: rand(2.6, 4),
        color: Math.random() < 0.22 ? '#FFFFFF' : shell.color
      });
    }

    for (let i = 0; i < shell.secondary; i++) {
      addShell(makeShell({
        x: shell.x + rand(-40, 40),
        y: shell.y + rand(-20, 20),
        targetOffset: rand(14, 30),
        delay: rand(10, 14) * scale,
        scale,
        burstCount: 12,
        burstSpeed: 3.4,
        burstLife: 24 * scale,
        secondary: 0,
        color: pick(SHELL_COLORS)
      }));
    }
  }

  function makeShell({ x, y, targetOffset, delay, scale, burstCount, burstSpeed, burstLife, secondary, color }) {
    // Shells fly under thrust: almost no gravity, so the rise is quick and
    // predictable and the whole firework is over before the next pipe.
    const speed = (targetOffset / 34) / Math.max(scale, 0.35);
    return {
      x, y,
      vy: -Math.max(speed, 1.6),
      targetY: y - targetOffset,
      delay,
      scale,
      trailTimer: 0,
      burstCount, burstSpeed, burstLife, secondary, color
    };
  }

  return {
    /**
     * Fires the effect for a tier. x/y is the bird, width/height the canvas,
     * lifeScale shortens everything at high speed levels so an effect never
     * lives long enough to sit on top of the next pipe.
     */
    celebrate(tier, { x = 0, y = 0, width = 800, height = 600, groundY = null, lifeScale = 1 } = {}) {
      const spec = tierSpec(tier);
      if (!spec) return;

      const s = Math.min(Math.max(lifeScale, 0.3), 1);
      const floor = groundY == null ? height - 40 : groundY;

      // Puff around the bird - always the first thing you see
      for (let i = 0; i < spec.sparks; i++) {
        spawn({
          x, y, kind: 'spark',
          angle: -Math.PI / 2, spread: TAU,
          speed: 3 + tier * 0.25,
          life: (30 + tier * 2) * s,
          size: rand(2.4, 4)
        });
      }

      // Twinkling stars hang in the air where the answer was taken
      for (let i = 0; i < spec.stars; i++) {
        spawn({
          x, y, kind: 'star',
          angle: -Math.PI / 2, spread: TAU,
          speed: 2.1,
          life: (34 + tier * 2) * s,
          size: rand(4, 7)
        });
      }

      for (let i = 0; i < spec.rings; i++) {
        addRing({
          x, y,
          radius: 8 + i * 6,
          growth: (3.2 + i * 0.7) / s,
          life: (30 - i * 5) * s,
          color: i === 0 ? '#FFB200' : '#FF3D9A',
          width: 8 - i
        });
      }

      // Jets from the bottom corners: they frame the play area without
      // crossing the answer bubbles in the middle of the screen.
      for (let j = 0; j < spec.jets; j++) {
        const jetX = j === 0 ? 46 : width - 46;
        const inward = j === 0 ? 0.42 : -0.42;
        for (let i = 0; i < 16; i++) {
          spawn({
            x: jetX, y: floor, kind: 'spark',
            angle: -Math.PI / 2 + inward, spread: 0.55,
            speed: 11.5,
            life: 44 * s,
            size: rand(2.4, 3.8)
          });
        }
      }

      // Sparkler fountain under the bird, rising behind the action
      for (let f = 0; f < spec.fountain; f++) {
        const fx = x + (f === 0 ? 0 : rand(70, 150));
        for (let i = 0; i < 20; i++) {
          spawn({
            x: fx, y: floor, kind: 'spark',
            angle: -Math.PI / 2, spread: 0.7,
            speed: 12.5,
            life: 50 * s,
            size: rand(2.2, 3.4),
            // gold and orange: white vanishes against a bright sky
            color: i % 3 === 0 ? '#FF7A1F' : '#FFC42E'
          });
        }
      }

      // Fireworks: shells launch from just above the ground and burst high in
      // the sky, well clear of the bird's lane.
      for (let i = 0; i < spec.shells; i++) {
        const spread = spec.shells === 1 ? [0.62] : [0.34, 0.58, 0.82];
        const shellX = width * spread[i % spread.length] + rand(-24, 24);
        const shellY = floor - 10;
        addShell(makeShell({
          x: shellX,
          y: shellY,
          targetOffset: shellY - height * rand(0.16, 0.34),
          delay: i * 7 * s,
          scale: s,
          burstCount: spec.secondary ? 30 : 26,
          burstSpeed: spec.secondary ? 7.6 : 7,
          burstLife: 46 * s,
          secondary: spec.secondary ? 2 : 0,
          color: pick(SHELL_COLORS)
        }));
      }
    },

    // dt is the frame-rate normalised delta (1.0 at 60fps).
    update(dt = 1) {
      if (shells.length) {
        const rising = [];
        for (const shell of shells) {
          if (shell.delay > 0) {
            shell.delay -= dt;
            rising.push(shell);
            continue;
          }
          shell.y += shell.vy * dt;
          shell.trailTimer -= dt;
          if (shell.trailTimer <= 0) {
            shell.trailTimer = 2;
            spawn({
              x: shell.x, y: shell.y, kind: 'trail',
              angle: Math.PI / 2, spread: 1.1,
              speed: 0.8,
              life: 16 * shell.scale,
              size: rand(1.4, 2.4),
              color: shell.color
            });
          }
          if (shell.y <= shell.targetY) explode(shell);
          else rising.push(shell);
        }
        shells = rising;
      }

      if (particles.length) {
        for (const p of particles) {
          const physics = KINDS[p.kind] || KINDS.spark;
          const drag = physics.drag ** dt;
          p.vy += physics.gravity * dt;
          p.vx *= drag;
          p.vy *= drag;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.age += dt;
          const left = p.life - p.age;
          p.alpha = left < FADE_FRAMES ? Math.max(0, left / FADE_FRAMES) : 1;
        }
        particles = particles.filter(p => p.age < p.life);
      }

      if (rings.length) {
        for (const r of rings) {
          r.radius += r.growth * dt;
          r.age += dt;
          r.alpha = Math.max(0, 1 - r.age / r.life);
        }
        rings = rings.filter(r => r.age < r.life);
      }
    },

    /** A wrong answer: snuff the celebration quickly instead of leaving it hanging. */
    extinguish() {
      shells = [];
      for (const p of particles) {
        p.life = Math.min(p.life, p.age + EXTINGUISH_LIFE);
      }
      for (const r of rings) {
        r.life = Math.min(r.life, r.age + EXTINGUISH_LIFE);
      }
    },

    render(ctx) {
      if (!particles.length && !rings.length && !shells.length) return;

      ctx.save();
      ctx.lineCap = 'round';

      for (const r of rings) {
        ctx.globalAlpha = r.alpha;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(1.5, r.width * r.alpha);
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, TAU);
        ctx.stroke();
      }

      // Shells in flight are a single bright dot; the trail behind them is
      // made of real particles.
      ctx.globalAlpha = 1;
      for (const shell of shells) {
        if (shell.delay > 0) continue;
        ctx.fillStyle = shell.color;
        ctx.beginPath();
        ctx.arc(shell.x, shell.y, 3, 0, TAU);
        ctx.fill();
      }

      for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        if (p.kind === 'star') {
          // Four-ray sparkle that pulses, drawn as two crossing strokes
          const twinkle = 0.55 + 0.45 * Math.abs(Math.sin(p.age * 0.32 + p.phase));
          const r = p.size * twinkle;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(p.x - r, p.y);
          ctx.lineTo(p.x + r, p.y);
          ctx.moveTo(p.x, p.y - r);
          ctx.lineTo(p.x, p.y + r);
          ctx.stroke();
        } else {
          // Motion streak: cheaper than a trail history and reads as speed
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    },

    getParticles() { return particles; },
    getRings() { return rings; },
    getShells() { return shells; },
    getExplosions() { return explosions; },

    counts() {
      return { particles: particles.length, rings: rings.length, shells: shells.length };
    },

    count() {
      return particles.length + rings.length + shells.length;
    },

    isActive() {
      return this.count() > 0;
    },

    clear() {
      particles = [];
      rings = [];
      shells = [];
      explosions = 0;
    }
  };
}
