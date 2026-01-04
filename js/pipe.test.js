import { describe, test, expect } from 'vitest';
import { createPipe } from './pipe.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PIPE_WIDTH } from './constants.js';

describe('Pipe', () => {
  test('creates pipe at right edge of screen', () => {
    const pipe = createPipe([10, 20, 30]);
    expect(pipe.x).toBe(CANVAS_WIDTH);
  });

  test('has 3 gaps with answers', () => {
    const answers = [10, 20, 30];
    const pipe = createPipe(answers);
    expect(pipe.gaps).toHaveLength(3);
    expect(pipe.gaps[0].answer).toBe(10);
    expect(pipe.gaps[1].answer).toBe(20);
    expect(pipe.gaps[2].answer).toBe(30);
  });

  test('gaps have y positions distributed across screen', () => {
    const pipe = createPipe([10, 20, 30]);
    const [top, middle, bottom] = pipe.gaps;

    expect(top.y).toBeLessThan(middle.y);
    expect(middle.y).toBeLessThan(bottom.y);
  });

  test('moves left each update', () => {
    const pipe = createPipe([10, 20, 30]);
    const initialX = pipe.x;
    pipe.update(5); // speed 5
    expect(pipe.x).toBe(initialX - 5);
  });

  test('is marked for removal when off screen', () => {
    const pipe = createPipe([10, 20, 30]);
    pipe.x = -PIPE_WIDTH - 10;
    expect(pipe.isOffScreen()).toBe(true);
  });

  test('is not marked for removal when on screen', () => {
    const pipe = createPipe([10, 20, 30]);
    expect(pipe.isOffScreen()).toBe(false);
  });

  test('tracks if bird has passed', () => {
    const pipe = createPipe([10, 20, 30]);
    expect(pipe.passed).toBe(false);
    pipe.markPassed();
    expect(pipe.passed).toBe(true);
  });
});
