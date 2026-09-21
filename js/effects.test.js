import { describe, test, expect, beforeEach } from 'vitest';
import {
  createEffects,
  tierForStreak,
  tierSpec,
  MAX_TIER,
  MAX_PARTICLES,
  EFFECT_COLORS
} from './effects.js';

const SCENE = { x: 150, y: 300, width: 800, height: 600 };

// Runs the simulation forward a number of 60fps steps.
function advance(effects, frames, dt = 1) {
  for (let i = 0; i < frames; i++) effects.update(dt);
}

describe('Effects', () => {
  let effects;

  beforeEach(() => {
    effects = createEffects();
  });

  describe('tier selection', () => {
    test('no streak means no effect', () => {
      expect(tierForStreak(0)).toBe(0);
      expect(tierForStreak(-3)).toBe(0);
    });

    test('the first correct answer is tier 1', () => {
      expect(tierForStreak(1)).toBe(1);
    });

    test('each consecutive correct answer climbs one tier', () => {
      for (let streak = 1; streak <= MAX_TIER; streak++) {
        expect(tierForStreak(streak)).toBe(streak);
      }
    });

    test('the ladder tops out at the fireworks tier', () => {
      expect(tierForStreak(MAX_TIER + 1)).toBe(MAX_TIER);
      expect(tierForStreak(99)).toBe(MAX_TIER);
    });

    test('a broken streak drops back to tier 1 on the next answer', () => {
      expect(tierForStreak(7)).toBe(MAX_TIER);
      // scoring.streak is reset to 0 on a wrong answer, then counts up again
      expect(tierForStreak(0)).toBe(0);
      expect(tierForStreak(1)).toBe(1);
    });

    test('there are between 5 and 7 tiers', () => {
      expect(MAX_TIER).toBeGreaterThanOrEqual(5);
      expect(MAX_TIER).toBeLessThanOrEqual(7);
    });
  });

  describe('tier specs', () => {
    test('every tier has its own name', () => {
      const names = [];
      for (let t = 1; t <= MAX_TIER; t++) names.push(tierSpec(t).name);
      expect(new Set(names).size).toBe(MAX_TIER);
    });

    test('tiers get heavier as the streak climbs', () => {
      for (let t = 2; t <= MAX_TIER; t++) {
        expect(tierSpec(t).weight).toBeGreaterThan(tierSpec(t - 1).weight);
      }
    });

    test('every tier throws some confetti for the game to fire', () => {
      for (let t = 1; t <= MAX_TIER; t++) {
        expect(tierSpec(t).confetti).toBeGreaterThan(0);
      }
    });

    test('tier 0 has no spec', () => {
      expect(tierSpec(0)).toBe(null);
    });

    test('tiers above the top clamp to the top tier', () => {
      expect(tierSpec(MAX_TIER + 5)).toBe(tierSpec(MAX_TIER));
    });

    test('only the top tiers launch fireworks shells', () => {
      for (let t = 1; t <= MAX_TIER - 2; t++) {
        expect(tierSpec(t).shells).toBe(0);
      }
      expect(tierSpec(MAX_TIER - 1).shells).toBeGreaterThan(0);
      expect(tierSpec(MAX_TIER).shells).toBeGreaterThan(tierSpec(MAX_TIER - 1).shells);
    });

    test('the finale adds secondary bursts, the single shell does not', () => {
      expect(tierSpec(MAX_TIER).secondary).toBe(true);
      expect(tierSpec(MAX_TIER - 1).secondary).toBe(false);
    });
  });

  describe('celebrating', () => {
    test('starts empty and inactive', () => {
      expect(effects.count()).toBe(0);
      expect(effects.isActive()).toBe(false);
    });

    test('tier 0 spawns nothing', () => {
      effects.celebrate(0, SCENE);
      expect(effects.count()).toBe(0);
    });

    test('a tier 1 celebration spawns a small puff of particles', () => {
      effects.celebrate(1, SCENE);
      const n = effects.counts().particles;
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThan(40);
    });

    test('the spark tiers spawn more particles the higher the tier', () => {
      let previous = 0;
      for (let t = 1; t <= MAX_TIER - 2; t++) {
        const fx = createEffects();
        fx.celebrate(t, SCENE);
        const n = fx.counts().particles;
        expect(n).toBeGreaterThan(previous);
        previous = n;
      }
    });

    test('bird-centred sparks start at the given origin', () => {
      effects.celebrate(1, SCENE);
      effects.getParticles().forEach(p => {
        expect(p.x).toBeCloseTo(SCENE.x, 5);
        expect(p.y).toBeCloseTo(SCENE.y, 5);
      });
    });

    test('particles use the effect palette', () => {
      effects.celebrate(5, SCENE);
      effects.getParticles().forEach(p => {
        expect(EFFECT_COLORS).toContain(p.color);
      });
    });

    test('the shockwave tiers add expanding rings', () => {
      const fx = createEffects();
      fx.celebrate(3, SCENE);
      expect(fx.counts().rings).toBeGreaterThan(0);
    });

    test('the firework tier launches shells that fly upward', () => {
      effects.celebrate(MAX_TIER - 1, SCENE);
      const shells = effects.getShells();
      expect(shells.length).toBe(tierSpec(MAX_TIER - 1).shells);
      shells.forEach(shell => {
        expect(shell.vy).toBeLessThan(0);          // rising
        expect(shell.targetY).toBeLessThan(shell.y); // bursts above where it started
      });
    });

    test('finale shells are staggered so they do not all burst at once', () => {
      effects.celebrate(MAX_TIER, SCENE);
      const delays = effects.getShells().map(s => s.delay);
      expect(new Set(delays).size).toBeGreaterThan(1);
    });
  });

  describe('physics', () => {
    test('particles move along their velocity', () => {
      effects.celebrate(1, SCENE);
      const p = effects.getParticles()[0];
      const { x, y, vx } = p;
      effects.update(1);
      // drag is applied before the step, so the move is vx trimmed a little
      expect(Math.sign(p.x - x)).toBe(Math.sign(vx));
      expect(Math.abs(p.x - x)).toBeLessThanOrEqual(Math.abs(vx));
      expect(Math.abs(p.x - x)).toBeGreaterThan(Math.abs(vx) * 0.8);
      expect(p.y).not.toBe(y);
    });

    test('gravity pulls particles down and drag slows them', () => {
      effects.celebrate(1, SCENE);
      const p = effects.getParticles()[0];
      p.vx = 0;
      p.vy = 0;
      effects.update(1);
      expect(p.vy).toBeGreaterThan(0);   // falling

      p.vx = 4;
      const fast = p.vx;
      effects.update(1);
      expect(p.vx).toBeLessThan(fast);   // air drag
    });

    test('particles age and fade out at the end of their life', () => {
      effects.celebrate(1, SCENE);
      const p = effects.getParticles()[0];
      expect(p.alpha).toBe(1);
      advance(effects, Math.ceil(p.life) - 1);
      const survivor = effects.getParticles()[0];
      if (survivor) expect(survivor.alpha).toBeLessThan(1);
    });

    test('particles are removed once their life runs out', () => {
      effects.celebrate(1, SCENE);
      advance(effects, 400);
      expect(effects.counts().particles).toBe(0);
      expect(effects.isActive()).toBe(false);
    });

    test('a bigger dt advances the simulation further', () => {
      const slow = createEffects();
      const fast = createEffects();
      slow.celebrate(1, SCENE);
      fast.celebrate(1, SCENE);
      slow.update(1);
      fast.update(2);
      expect(fast.getParticles()[0].age).toBe(2);
      expect(slow.getParticles()[0].age).toBe(1);
    });

    test('lifeScale shortens effects so they do not overlap the next pipe', () => {
      const long = createEffects();
      const short = createEffects();
      long.celebrate(4, { ...SCENE, lifeScale: 1 });
      short.celebrate(4, { ...SCENE, lifeScale: 0.4 });
      const longest = Math.max(...long.getParticles().map(p => p.life));
      const shortest = Math.max(...short.getParticles().map(p => p.life));
      expect(shortest).toBeLessThan(longest);
    });

    test('everything is gone well inside two seconds at full life', () => {
      effects.celebrate(MAX_TIER, SCENE);
      advance(effects, 120); // 2 s at 60fps
      expect(effects.isActive()).toBe(false);
    });

    test('rings expand and then disappear', () => {
      effects.celebrate(3, SCENE);
      const ring = effects.getRings()[0];
      const r0 = ring.radius;
      effects.update(1);
      expect(ring.radius).toBeGreaterThan(r0);
      advance(effects, 200);
      expect(effects.counts().rings).toBe(0);
    });

    test('updating an idle effects layer is harmless', () => {
      expect(() => advance(effects, 10)).not.toThrow();
      expect(effects.count()).toBe(0);
    });
  });

  describe('fireworks', () => {
    test('a shell explodes into a spray of sparks and a ring', () => {
      effects.celebrate(MAX_TIER - 1, SCENE);
      expect(effects.counts().shells).toBeGreaterThan(0);

      advance(effects, 90);
      expect(effects.counts().shells).toBe(0);      // all shells have burst
      expect(effects.getExplosions()).toBeGreaterThan(0);
    });

    test('the burst throws sparks in every direction', () => {
      effects.celebrate(MAX_TIER - 1, SCENE);
      advance(effects, 60);
      const parts = effects.getParticles().filter(p => p.kind === 'spark');
      expect(parts.some(p => p.vx > 0)).toBe(true);
      expect(parts.some(p => p.vx < 0)).toBe(true);
      expect(parts.some(p => p.vy < 0)).toBe(true);
    });

    test('the finale fires secondary crackle bursts after the main ones', () => {
      effects.celebrate(MAX_TIER, SCENE);
      advance(effects, 45);
      const explosionsEarly = effects.getExplosions();
      advance(effects, 45);
      expect(effects.getExplosions()).toBeGreaterThan(explosionsEarly);
    });

    test('shells leave a trail on the way up', () => {
      effects.celebrate(MAX_TIER - 1, SCENE);
      advance(effects, 8);
      expect(effects.getParticles().some(p => p.kind === 'trail')).toBe(true);
    });
  });

  describe('limits and cleanup', () => {
    test('spamming the top tier never exceeds the particle cap', () => {
      for (let i = 0; i < 40; i++) {
        effects.celebrate(MAX_TIER, SCENE);
        effects.update(1);
      }
      expect(effects.counts().particles).toBeLessThanOrEqual(MAX_PARTICLES);
    });

    test('shells and rings are capped too', () => {
      for (let i = 0; i < 40; i++) effects.celebrate(MAX_TIER, SCENE);
      expect(effects.counts().shells).toBeLessThanOrEqual(24);
      expect(effects.counts().rings).toBeLessThanOrEqual(24);
    });

    test('clear() empties the layer so effects never leak between runs', () => {
      effects.celebrate(MAX_TIER, SCENE);
      expect(effects.isActive()).toBe(true);
      effects.clear();
      expect(effects.count()).toBe(0);
      expect(effects.counts()).toEqual({ particles: 0, rings: 0, shells: 0 });
      expect(effects.isActive()).toBe(false);
      expect(effects.getExplosions()).toBe(0);
    });
  });

  describe('breaking the streak', () => {
    test('extinguish() fades what is left out quickly instead of freezing it', () => {
      effects.celebrate(MAX_TIER, SCENE);
      effects.extinguish();
      effects.getParticles().forEach(p => {
        expect(p.life - p.age).toBeLessThanOrEqual(12);
      });
      advance(effects, 12);
      expect(effects.isActive()).toBe(false);
    });

    test('extinguish() cancels pending shells so no firework goes off after a mistake', () => {
      effects.celebrate(MAX_TIER, SCENE);
      const before = effects.getExplosions();
      effects.extinguish();
      expect(effects.counts().shells).toBe(0);
      advance(effects, 120);
      expect(effects.getExplosions()).toBe(before);
    });
  });
});
