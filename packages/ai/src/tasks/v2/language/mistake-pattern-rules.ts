const DRILL_BLANK = "___";

/** A pattern needs at least two mistakes that show it; one mistake is just a mistake. */
const MIN_PATTERN_MISTAKES = 2;

const BLANK_PATTERN = /_+/gu;

type DrillQuestion = { sentence: string; answer: string; options: string[]; feedback: string };

export type MistakePattern = {
  kind: "pattern" | "typos" | "none";
  title: string;
  rule: string;
  mistakeNumbers: number[];
  contrast: { label: string; example: string }[];
  drill: DrillQuestion[];
};

const NO_PATTERN: MistakePattern = {
  contrast: [],
  drill: [],
  kind: "none",
  mistakeNumbers: [],
  rule: "",
  title: "",
};

/**
 * A drill question a learner can answer: one blank, the answer among the
 * options, and options they can tell apart. Accents and case count, since
 * "esta" and "está" are different answers.
 */
export function isWellFormedDrillQuestion(question: DrillQuestion): boolean {
  const options = question.options.map((option) => option.trim());

  return (
    (question.sentence.match(BLANK_PATTERN) ?? []).length === 1 &&
    options.includes(question.answer.trim()) &&
    new Set(options).size === options.length
  );
}

function toValidMistakeNumbers({
  mistakeCount,
  numbers,
}: {
  mistakeCount: number;
  numbers: number[];
}): number[] {
  const valid = numbers.filter(
    (number) => Number.isInteger(number) && number >= 1 && number <= mistakeCount,
  );

  return [...new Set(valid)].toSorted((first, second) => first - second);
}

/**
 * Keeps only what the screen can show honestly: mistake numbers that exist,
 * drill questions a learner can answer (with the blank written the same way
 * everywhere), no drill unless there is a pattern, and "none" for a pattern
 * that fewer than two mistakes show.
 */
export function normalizeMistakePattern({
  mistakeCount,
  pattern,
}: {
  mistakeCount: number;
  pattern: MistakePattern;
}): MistakePattern {
  const mistakeNumbers = toValidMistakeNumbers({ mistakeCount, numbers: pattern.mistakeNumbers });

  if (pattern.kind === "none") {
    return NO_PATTERN;
  }

  if (pattern.kind === "typos") {
    return { ...pattern, contrast: [], drill: [], mistakeNumbers };
  }

  if (mistakeNumbers.length < MIN_PATTERN_MISTAKES) {
    return NO_PATTERN;
  }

  const drill = pattern.drill
    .filter((question) => isWellFormedDrillQuestion(question))
    .map((question) => ({
      ...question,
      sentence: question.sentence.replace(BLANK_PATTERN, DRILL_BLANK),
    }));

  return { ...pattern, drill, mistakeNumbers };
}
