import { describe, test, expect } from 'vitest';
import { createPipe } from './pipe.js';
import { BASE_WIDTH, PIPE_WIDTH } from './constants.js';

const TEST_CANVAS_WIDTH = 800;

describe('Pipe', () => {
  test('creates pipe at right edge of screen', () => {
    const pipe = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    expect(pipe.x).toBe(TEST_CANVAS_WIDTH);
  });

  test('has 3 gaps with answers', () => {
    const answers = [10, 20, 30];
    const pipe = createPipe(answers, TEST_CANVAS_WIDTH);
    expect(pipe.gaps).toHaveLength(3);
    expect(pipe.gaps[0].answer).toBe(10);
    expect(pipe.gaps[1].answer).toBe(20);
    expect(pipe.gaps[2].answer).toBe(30);
  });

  test('gaps have y positions distributed across screen', () => {
    const pipe = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    const [top, middle, bottom] = pipe.gaps;

    expect(top.y).toBeLessThan(middle.y);
    expect(middle.y).toBeLessThan(bottom.y);
  });

  test('moves left each update', () => {
    const pipe = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    const initialX = pipe.x;
    pipe.update(5); // speed 5
    expect(pipe.x).toBe(initialX - 5);
  });

  test('is marked for removal when off screen', () => {
    const pipe = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    pipe.x = -PIPE_WIDTH - 10;
    expect(pipe.isOffScreen()).toBe(true);
  });

  test('is not marked for removal when on screen', () => {
    const pipe = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    expect(pipe.isOffScreen()).toBe(false);
  });

  test('tracks if bird has passed', () => {
    const pipe = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    expect(pipe.passed).toBe(false);
    pipe.markPassed();
    expect(pipe.passed).toBe(true);
  });

  test('dt=0.5 produces half the movement of dt=1', () => {
    const pipe1 = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    const pipe2 = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    const speed = 5;

    // Update at 60fps (dt=1)
    pipe1.update(speed, 1);
    const movement60 = TEST_CANVAS_WIDTH - pipe1.x;

    // Update at 120fps (dt=0.5)
    pipe2.update(speed, 0.5);
    const movement120 = TEST_CANVAS_WIDTH - pipe2.x;

    // At half dt, should get half the movement
    expect(movement120).toBeCloseTo(movement60 / 2, 5);
  });

  test('two dt=0.5 updates equal one dt=1 update', () => {
    const pipe1 = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    const pipe2 = createPipe([10, 20, 30], TEST_CANVAS_WIDTH);
    const speed = 5;

    // One 60fps frame
    pipe1.update(speed, 1);

    // Two 120fps frames
    pipe2.update(speed, 0.5);
    pipe2.update(speed, 0.5);

    // Should be equal
    expect(pipe2.x).toBeCloseTo(pipe1.x, 5);
  });
});
