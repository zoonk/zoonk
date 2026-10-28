export type OptionPicks = {
  correct: number;
  isCorrect: boolean;
  missed: number;
  right: number;
  wrong: number;
};

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
