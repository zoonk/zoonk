import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";
import { evaluateFormula } from "../activities/expression/evaluate-expression";
import { withinTolerance } from "../activities/templates/_utils/pattern-checks";
import { type MathValues, fillMathStep, fillMathText, getValues } from "./_utils/math-values";

const MAX_NEW_NUMBER_TRIES = 20;
const DECIMAL_PRECISION = 12;

/**
 * Steps like 0.1 accumulate binary error: (0.3 - 0.1) / 0.1 is 1.999…, which
 * would make the maximum unreachable, and 0.1 + 0.2 would show up in a question
 * as 0.30000000000000004.
 */
function toDecimal(value: number): number {
  return Number(value.toPrecision(DECIMAL_PRECISION));
}

function drawValue(
  variable: GeneratedMathProblem["variables"][number],
  random: () => number,
): number {
  const stepCount = Math.floor(toDecimal((variable.max - variable.min) / variable.step));
  const stepIndex = Math.min(Math.floor(random() * (stepCount + 1)), stepCount);

  return toDecimal(variable.min + stepIndex * variable.step);
}

function drawValues(math: GeneratedMathProblem, random: () => number): MathValues {
  return Object.fromEntries(
    math.variables.map((variable) => [variable.name, drawValue(variable, random)]),
  );
}

/**
 * At some values a wrong method gives the right number (at 50% off, the
 * discount equals the price paid), so a learner making that mistake would be
 * marked right. Those draws are skipped.
 */
function isMistakeIndistinct({
  correct,
  math,
  values,
}: {
  correct: number;
  math: GeneratedMathProblem;
  values: MathValues;
}): boolean {
  return math.commonMistakes.some((mistake) => {
    const result = evaluateFormula(mistake.expression, values);

    return (
      result.ok &&
      withinTolerance({ expected: correct, tolerance: math.tolerance, value: result.value })
    );
  });
}

/** A version of a math item with its numbers in place: what the learner sees and what's right. */
export type MathVersion = {
  answer: number;
  context: string | null;
  question: string;
  steps: string[];
  values: MathValues;
};

type MathText = {
  context?: string | null;
  language?: string;
  math: GeneratedMathProblem;
  question: string;
};

function fillMathVersion({
  answer,
  context = null,
  language,
  math,
  question,
  values,
}: MathText & { answer: number; values: MathValues }): MathVersion {
  return {
    answer,
    context: context === null ? null : fillMathText({ language, text: context, values }),
    question: fillMathText({ language, text: question, values }),
    steps: math.steps.map((step) => fillMathStep({ language, step, values })),
    values,
  };
}

/** The version the item was checked with, for when no fresh draw works. */
function checkedVersion(text: MathText): MathVersion {
  const values = getValues(text.math);
  const solution = evaluateFormula(text.math.solution, values);

  return fillMathVersion({
    ...text,
    answer: solution.ok ? solution.value : text.math.answer,
    values,
  });
}

/**
 * Makes a fresh version of a checked math item: new values within each
 * variable's range, the context, question and worked steps filled in (numbers
 * written the way `language` writes them) and the answer recomputed. Draws
 * again when a draw hits a value the solution can't use (such as a zero
 * divisor) or makes a common mistake look right, and keeps the numbers the
 * item was checked with if none works. A seeded `random` gives the same
 * version every time, so one serving always shows and grades the same numbers.
 */
export function withNewNumbers({
  random = Math.random,
  ...text
}: MathText & { random?: () => number }): MathVersion {
  const { math } = text;
  const draws = Array.from({ length: MAX_NEW_NUMBER_TRIES }, () => drawValues(math, random));

  const found = draws
    .map((values) => ({ result: evaluateFormula(math.solution, values), values }))
    .find(
      (draw) =>
        draw.result.ok &&
        !isMistakeIndistinct({ correct: draw.result.value, math, values: draw.values }),
    );

  if (!found?.result.ok) {
    return checkedVersion(text);
  }

  return fillMathVersion({ ...text, answer: found.result.value, values: found.values });
}

/**
 * Grades a number typed for a math item with the values the learner saw. A
 * wrong answer that matches a common mistake returns that mistake, so the
 * feedback can name what went wrong.
 */
export function checkMathAnswer({
  answer,
  math,
  values,
}: {
  answer: number;
  math: GeneratedMathProblem;
  values: Readonly<MathValues>;
}): { isCorrect: boolean; mistake: GeneratedMathProblem["commonMistakes"][number] | null } {
  const correct = evaluateFormula(math.solution, values);

  if (
    correct.ok &&
    withinTolerance({ expected: correct.value, tolerance: math.tolerance, value: answer })
  ) {
    return { isCorrect: true, mistake: null };
  }

  const mistake = math.commonMistakes.find((candidate) => {
    const result = evaluateFormula(candidate.expression, values);

    return (
      result.ok &&
      withinTolerance({ expected: result.value, tolerance: math.tolerance, value: answer })
    );
  });

  return { isCorrect: false, mistake: mistake ?? null };
}
