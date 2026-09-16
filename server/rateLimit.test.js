import { describe, test, expect } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

describe('RateLimiter', () => {
  test('allows requests up to the limit', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });

    expect(limiter.check('1.2.3.4', 0)).toBe(true);
    expect(limiter.check('1.2.3.4', 100)).toBe(true);
    expect(limiter.check('1.2.3.4', 200)).toBe(true);
  });

  test('blocks requests beyond the limit inside the window', () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    limiter.check('1.2.3.4', 0);
    limiter.check('1.2.3.4', 10);

    expect(limiter.check('1.2.3.4', 20)).toBe(false);
  });

  test('allows again once the window has passed', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.check('1.2.3.4', 0);

    expect(limiter.check('1.2.3.4', 500)).toBe(false);
    expect(limiter.check('1.2.3.4', 1001)).toBe(true);
  });

  test('tracks keys independently', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    limiter.check('1.2.3.4', 0);

    expect(limiter.check('5.6.7.8', 0)).toBe(true);
  });

  test('treats a missing key as a single shared bucket', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    expect(limiter.check(undefined, 0)).toBe(true);
    expect(limiter.check(undefined, 1)).toBe(false);
  });

  test('forgets keys whose window expired, so memory stays bounded', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    for (let i = 0; i < 50; i++) {
      limiter.check(`ip-${i}`, 0);
    }
    expect(limiter.size()).toBe(50);

    limiter.check('fresh', 2000);
    expect(limiter.size()).toBe(1);
  });

  test('drops the oldest keys when the tracked set grows too large', () => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60000, maxKeys: 10 });
    for (let i = 0; i < 25; i++) {
      limiter.check(`ip-${i}`, i);
    }

    expect(limiter.size()).toBeLessThanOrEqual(10);
  });
});
