import { describe, test, expect } from 'vitest';
import { generateProblem } from './math.js';

describe('Math Problem Generation', () => {
  test('generates correct answer for multiplication', () => {
    const problem = generateProblem(7, 8);
    expect(problem.correctAnswer).toBe(56);
  });

  test('generates problem text', () => {
    const problem = generateProblem(7, 8);
    expect(problem.text).toBe('7 × 8 = ?');
  });

  test('includes operands a and b in problem', () => {
    const problem = generateProblem(7, 8);
    expect(problem.a).toBe(7);
    expect(problem.b).toBe(8);
  });

  test('generates 3 answers total', () => {
    const problem = generateProblem(5, 6);
    expect(problem.answers).toHaveLength(3);
  });

  test('includes correct answer in answers', () => {
    const problem = generateProblem(5, 6);
    expect(problem.answers).toContain(30);
  });

  test('wrong answers are plausible (nearby values)', () => {
    const problem = generateProblem(7, 8);
    problem.answers.forEach(answer => {
      if (answer !== problem.correctAnswer) {
        expect(Math.abs(answer - problem.correctAnswer)).toBeLessThanOrEqual(20);
      }
    });
  });

  test('all answers are unique', () => {
    // Run multiple times to catch randomness issues
    for (let i = 0; i < 10; i++) {
      const problem = generateProblem(6, 7);
      const uniqueAnswers = new Set(problem.answers);
      expect(uniqueAnswers.size).toBe(3);
    }
  });

  test('wrong answers do not include correct answer', () => {
    for (let i = 0; i < 10; i++) {
      const problem = generateProblem(8, 9);
      const wrongAnswers = problem.answers.filter(a => a !== problem.correctAnswer);
      expect(wrongAnswers).toHaveLength(2);
      wrongAnswers.forEach(wrong => {
        expect(wrong).not.toBe(problem.correctAnswer);
      });
    }
  });

  test('shuffles answer positions', () => {
    // Run many times and check that correct answer isn't always in same position
    const positions = [];
    for (let i = 0; i < 20; i++) {
      const problem = generateProblem(3, 4);
      positions.push(problem.answers.indexOf(problem.correctAnswer));
    }
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBeGreaterThan(1);
  });

  test('generates problems for any table 2-12', () => {
    for (let table = 2; table <= 12; table++) {
      const multiplier = Math.floor(Math.random() * 12) + 1;
      const problem = generateProblem(table, multiplier);
      expect(problem.correctAnswer).toBe(table * multiplier);
    }
  });
});
