const DRILL_BLANK = "___";

/** A pattern needs at least two mistakes that show it; one mistake is just a mistake. */
const MIN_PATTERN_MISTAKES = 2;

const BLANK_PATTERN = /_+/gu;

type DrillQuestion = {
  sentence: string;
  answer: string;
  translation: string;
  options: string[];
  feedback: string;
};

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
 * Accents and case count, since "esta" and "está" are different answers. A learner reading the app
 * in another language needs the translation to know which meaning the blank takes; one reading it
 * in the language they learn would only see the answer given away.
 */
export function isWellFormedDrillQuestion({
  question,
  sameLanguage,
}: {
  question: DrillQuestion;
  sameLanguage: boolean;
}): boolean {
  const options = question.options.map((option) => option.trim());

  return (
    (question.sentence.match(BLANK_PATTERN) ?? []).length === 1 &&
    options.includes(question.answer.trim()) &&
    new Set(options).size === options.length &&
    (sameLanguage ? question.translation === "" : question.translation.trim() !== "")
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

/** No drill without a pattern, and "none" for a pattern fewer than two mistakes show. */
export function normalizeMistakePattern({
  mistakeCount,
  pattern,
  sameLanguage,
}: {
  mistakeCount: number;
  pattern: MistakePattern;
  sameLanguage: boolean;
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
    .filter((question) => isWellFormedDrillQuestion({ question, sameLanguage }))
    .map((question) => ({
      ...question,
      sentence: question.sentence.replaceAll(BLANK_PATTERN, DRILL_BLANK),
    }));

  return { ...pattern, drill, mistakeNumbers };
}
