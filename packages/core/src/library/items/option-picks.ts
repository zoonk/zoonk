/** How a learner's picks among a question's options went, for practice and for mock scoring. */
export type OptionPicks = {
  /** The question's right options. */
  correct: number;
  /** Right only when the picks are exactly the right options. */
  isCorrect: boolean;
  /** Right options left unpicked. */
  missed: number;
  /** Right options picked. */
  right: number;
  /** Wrong options picked, an index past the options included. */
  wrong: number;
};

/**
 * Grades the options a learner picked, in any order, against a question's right ones: it's right
 * only when they're exactly the right options, and the counts let a mock score partial credit the
 * way its exam does (a rule table in scoring, never here). A pick repeated counts once.
 */
export function gradeOptionPicks({
  options,
  picked,
}: {
  options: readonly { isCorrect: boolean }[];
  picked: readonly number[];
}): OptionPicks {
  const unique = [...new Set(picked)];
  const correct = options.filter((option) => option.isCorrect).length;
  const right = unique.filter((index) => options[index]?.isCorrect === true).length;
  const wrong = unique.length - right;

  return {
    correct,
    isCorrect: right === correct && wrong === 0,
    missed: correct - right,
    right,
    wrong,
  };
}
