export const practiceOptionLimit = 4;

type PracticeOption = { feedback: string; isCorrect: boolean; text: string };

/**
 * Ignores surrounding model whitespace when comparing visible answer labels
 * without changing meaningful capitalization or internal spacing.
 */
function getComparableOptionText(text: string): string {
  return text.trim();
}

/**
 * Keeps one copy of a repeated answer. When the model disagrees about whether
 * identical labels are correct, the correct copy preserves the answer rather
 * than accidentally turning the normalized question into an impossible one.
 * Whitespace-only labels have no preferred copy because they should be removed.
 */
function shouldKeepOption({
  option,
  options,
}: {
  option: PracticeOption;
  options: readonly PracticeOption[];
}): boolean {
  const comparableText = getComparableOptionText(option.text);

  if (!comparableText) {
    return false;
  }

  const repeatedOptions = options.filter(
    (candidate) => getComparableOptionText(candidate.text) === comparableText,
  );

  const [firstOption] = repeatedOptions;
  const preferredOption = repeatedOptions.find((candidate) => candidate.isCorrect);

  return preferredOption ? option === preferredOption : option === firstOption;
}

/**
 * Reduces extra distinct options only when there is one unambiguous correct
 * answer. Ambiguous generations stay unchanged so the caller can reject them
 * instead of silently inventing which answer should be correct.
 */
function limitPracticeOptions<Option extends PracticeOption>(options: Option[]): Option[] {
  if (options.length <= practiceOptionLimit) {
    return options;
  }

  const correctOptions = options.filter((option) => option.isCorrect);
  const [correctOption] = correctOptions;

  if (!correctOption || correctOptions.length !== 1) {
    return options;
  }

  const retainedOptions = new Set([
    correctOption,
    ...options.filter((option) => !option.isCorrect).slice(0, practiceOptionLimit - 1),
  ]);

  return options.filter((option) => retainedOptions.has(option));
}

/**
 * Repairs model output that contains blank, repeated, or extra practice
 * answers while preserving the generated copy and the only correct answer.
 */
export function normalizePracticeOptions<Option extends PracticeOption>(
  options: readonly Option[],
): Option[] {
  const trimmedOptions = options.map((option) => ({
    ...option,
    feedback: option.feedback.trim(),
    text: option.text.trim(),
  }));

  const uniqueOptions = trimmedOptions.filter((option) =>
    shouldKeepOption({ option, options: trimmedOptions }),
  );

  return limitPracticeOptions(uniqueOptions);
}
