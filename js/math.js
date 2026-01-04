export function generateProblem(a, b) {
  const correctAnswer = a * b;

  // Generate 2 plausible wrong answers
  const wrongAnswers = generateWrongAnswers(correctAnswer);

  // Combine and shuffle
  const answers = shuffle([correctAnswer, ...wrongAnswers]);

  return {
    text: `${a} × ${b} = ?`,
    a,
    b,
    correctAnswer,
    answers
  };
}

function generateWrongAnswers(correct) {
  const wrong = new Set();

  while (wrong.size < 2) {
    // Generate nearby values (within ±20, but not equal to correct)
    const offset = randomInt(-20, 20);
    if (offset === 0) continue;

    const candidate = correct + offset;
    if (candidate > 0 && candidate !== correct && !wrong.has(candidate)) {
      wrong.add(candidate);
    }
  }

  return Array.from(wrong);
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateProblemForTable(table) {
  const multiplier = randomInt(1, 12);
  return generateProblem(table, multiplier);
}
