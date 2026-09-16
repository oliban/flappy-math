import { describe, test, expect, beforeEach } from 'vitest';
import { createConfetti, CONFETTI_COLORS } from './confetti.js';

describe('Confetti', () => {
  let confetti;

  beforeEach(() => {
    confetti = createConfetti();
  });

  describe('bursting', () => {
    test('starts empty and inactive', () => {
      expect(confetti.count()).toBe(0);
      expect(confetti.isActive()).toBe(false);
    });

    test('a burst adds the requested number of pieces', () => {
      confetti.burst({ x: 100, y: 200, count: 25 });

      expect(confetti.count()).toBe(25);
      expect(confetti.isActive()).toBe(true);
    });

    test('pieces start at the burst origin', () => {
      confetti.burst({ x: 100, y: 200, count: 5, spread: 0 });

      confetti.getPieces().forEach(piece => {
        expect(piece.x).toBe(100);
        expect(piece.y).toBe(200);
      });
    });

    test('bursts accumulate', () => {
      confetti.burst({ x: 0, y: 0, count: 10 });
      confetti.burst({ x: 50, y: 50, count: 10 });

      expect(confetti.count()).toBe(20);
    });

    test('pieces use the confetti palette', () => {
      confetti.burst({ x: 0, y: 0, count: 40 });

      confetti.getPieces().forEach(piece => {
        expect(CONFETTI_COLORS).toContain(piece.color);
      });
    });

    test('pieces get varied velocities', () => {
      confetti.burst({ x: 0, y: 0, count: 40 });
      const velocities = new Set(confetti.getPieces().map(p => p.vx));

      expect(velocities.size).toBeGreaterThan(1);
    });

    test('an upward burst sends pieces upward', () => {
      confetti.burst({ x: 0, y: 500, count: 30, angle: -Math.PI / 2 });

      const rising = confetti.getPieces().filter(p => p.vy < 0);
      expect(rising.length).toBe(30);
    });

    test('a burst is capped so a stuck screen cannot grow without bound', () => {
      for (let i = 0; i < 40; i++) {
        confetti.burst({ x: 0, y: 0, count: 100 });
      }

      expect(confetti.count()).toBeLessThanOrEqual(600);
    });
  });

  describe('updating', () => {
    test('pieces move by their velocity', () => {
      confetti.burst({ x: 100, y: 100, count: 1, spread: 0, angle: 0, speed: 4 });
      const before = confetti.getPieces()[0];
      const startX = before.x;

      confetti.update(1);

      expect(confetti.getPieces()[0].x).toBeGreaterThan(startX);
    });

    test('gravity pulls pieces down over time', () => {
      confetti.burst({ x: 0, y: 0, count: 1, spread: 0, angle: 0, speed: 0 });

      confetti.update(1);
      const afterOne = confetti.getPieces()[0].vy;
      confetti.update(1);

      expect(afterOne).toBeGreaterThan(0);
      expect(confetti.getPieces()[0].vy).toBeGreaterThan(afterOne);
    });

    test('scales movement with delta time', () => {
      // Burst velocities are randomised, so pin both pieces to the same start.
      const start = (system) => {
        system.burst({ x: 0, y: 0, count: 1, spread: 0, angle: 0 });
        Object.assign(system.getPieces()[0], { x: 0, y: 0, vx: 3, vy: 0 });
        return system;
      };

      const slow = start(createConfetti());
      const fast = start(createConfetti());

      slow.update(0.5);
      slow.update(0.5);
      fast.update(1);

      // Two half steps land in the same place as one whole step, give or take
      // the usual Euler integration drift.
      expect(slow.getPieces()[0].x).toBeCloseTo(fast.getPieces()[0].x, 1);
      expect(slow.getPieces()[0].y).toBeCloseTo(fast.getPieces()[0].y, 1);
    });

    test('pieces spin as they fall', () => {
      confetti.burst({ x: 0, y: 0, count: 1 });
      const before = confetti.getPieces()[0].rotation;

      confetti.update(1);

      expect(confetti.getPieces()[0].rotation).not.toBe(before);
    });

    test('pieces fade as their life runs out', () => {
      confetti.burst({ x: 0, y: 0, count: 1, life: 10 });

      confetti.update(9);
      const piece = confetti.getPieces()[0];

      expect(piece.alpha).toBeLessThan(1);
      expect(piece.alpha).toBeGreaterThan(0);
    });

    test('expired pieces are removed', () => {
      confetti.burst({ x: 0, y: 0, count: 5, life: 10 });

      confetti.update(11);

      expect(confetti.count()).toBe(0);
      expect(confetti.isActive()).toBe(false);
    });

    test('updating an empty system is harmless', () => {
      expect(() => confetti.update(1)).not.toThrow();
      expect(confetti.count()).toBe(0);
    });
  });

  describe('clearing', () => {
    test('clear removes every piece', () => {
      confetti.burst({ x: 0, y: 0, count: 20 });
      confetti.clear();

      expect(confetti.count()).toBe(0);
      expect(confetti.isActive()).toBe(false);
    });
  });
});
