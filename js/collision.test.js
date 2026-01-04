import { describe, test, expect } from 'vitest';
import { checkCollision, CollisionResult } from './collision.js';
import { PIPE_WIDTH, PIPE_GAP_HEIGHT } from './constants.js';

describe('Collision Detection', () => {
  const mockBird = (x, y, size = 30) => ({ x, y, size });

  const mockPipe = (x, gaps) => ({
    x,
    width: PIPE_WIDTH,
    gaps: gaps.map((g, i) => ({
      answer: g.answer,
      y: g.y,
      height: PIPE_GAP_HEIGHT
    }))
  });

  test('returns NONE when bird is before pipe', () => {
    const bird = mockBird(50, 300);
    const pipe = mockPipe(200, [
      { answer: 10, y: 150 },
      { answer: 20, y: 300 },
      { answer: 30, y: 450 }
    ]);

    const result = checkCollision(bird, pipe);
    expect(result.type).toBe(CollisionResult.NONE);
  });

  test('returns NONE when bird is after pipe', () => {
    const bird = mockBird(350, 300);
    const pipe = mockPipe(200, [
      { answer: 10, y: 150 },
      { answer: 20, y: 300 },
      { answer: 30, y: 450 }
    ]);

    const result = checkCollision(bird, pipe);
    expect(result.type).toBe(CollisionResult.NONE);
  });

  test('returns GAP with answer when bird passes through gap', () => {
    const bird = mockBird(240, 300); // In middle of pipe, at gap y=300
    const pipe = mockPipe(200, [
      { answer: 10, y: 150 },
      { answer: 20, y: 300 },
      { answer: 30, y: 450 }
    ]);

    const result = checkCollision(bird, pipe);
    expect(result.type).toBe(CollisionResult.GAP);
    expect(result.answer).toBe(20);
  });

  test('returns PIPE when bird hits pipe (above gap)', () => {
    const bird = mockBird(240, 220); // Between gaps
    const pipe = mockPipe(200, [
      { answer: 10, y: 150 },
      { answer: 20, y: 300 },
      { answer: 30, y: 450 }
    ]);

    const result = checkCollision(bird, pipe);
    expect(result.type).toBe(CollisionResult.PIPE);
  });

  test('returns GAP for top gap', () => {
    const bird = mockBird(240, 150);
    const pipe = mockPipe(200, [
      { answer: 10, y: 150 },
      { answer: 20, y: 300 },
      { answer: 30, y: 450 }
    ]);

    const result = checkCollision(bird, pipe);
    expect(result.type).toBe(CollisionResult.GAP);
    expect(result.answer).toBe(10);
  });

  test('returns GAP for bottom gap', () => {
    const bird = mockBird(240, 450);
    const pipe = mockPipe(200, [
      { answer: 10, y: 150 },
      { answer: 20, y: 300 },
      { answer: 30, y: 450 }
    ]);

    const result = checkCollision(bird, pipe);
    expect(result.type).toBe(CollisionResult.GAP);
    expect(result.answer).toBe(30);
  });
});
