import { type GeneratedMathProblem, type NumericEntry } from "@zoonk/ai/tasks/v2/items/schemas";
import { evaluateFormula } from "../activities/expression/evaluate-expression";
import { withinTolerance } from "../activities/templates/_utils/pattern-checks";
import { type MathValues, fillMathStep, fillMathText, getValues } from "./_utils/math-values";
import { ANY_NUMBER, fitsEntry, matchesEntry } from "./_utils/numeric-entry";

const MAX_NEW_NUMBER_TRIES = 20;
const DECIMAL_PRECISION = 12;

/** Binary rounding can make slider endpoints unreachable or leak long decimals into questions. */
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

type AnswerRules = { entry?: NumericEntry; otherSolutions?: readonly string[] };

function getAcceptedValues({
  math,
  otherSolutions = [],
  values,
}: {
  math: GeneratedMathProblem;
  otherSolutions?: readonly string[];
  values: Readonly<MathValues>;
}): number[] | null {
  const results = [math.solution, ...otherSolutions].map((expression) =>
    evaluateFormula(expression, values),
  );

  return results.every((result) => result.ok)
    ? results.flatMap((result) => (result.ok ? [result.value] : []))
    : null;
}

function isMistakeIndistinct({
  accepted,
  entry,
  math,
  values,
}: {
  accepted: readonly number[];
  entry: NumericEntry;
  math: GeneratedMathProblem;
  values: MathValues;
}): boolean {
  return math.commonMistakes.some((mistake) => {
    const result = evaluateFormula(mistake.expression, values);

    return (
      result.ok &&
      accepted.some((expected) =>
        matchesEntry({ entry, expected, tolerance: math.tolerance, value: result.value }),
      )
    );
  });
}

function isUsableDraw({
  entry,
  math,
  otherSolutions,
  values,
}: {
  entry: NumericEntry;
  math: GeneratedMathProblem;
  otherSolutions?: readonly string[];
  values: MathValues;
}): boolean {
  const accepted = getAcceptedValues({ math, otherSolutions, values });

  return (
    accepted !== null &&
    accepted.every((value) => fitsEntry({ entry, value })) &&
    !isMistakeIndistinct({ accepted, entry, math, values })
  );
}

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

function checkedVersion(text: MathText): MathVersion {
  const values = getValues(text.math);
  const solution = evaluateFormula(text.math.solution, values);

  return fillMathVersion({
    ...text,
    answer: solution.ok ? solution.value : text.math.answer,
    values,
  });
}

export function withNewNumbers({
  entry = ANY_NUMBER,
  otherSolutions,
  random = Math.random,
  ...text
}: MathText & AnswerRules & { random?: () => number }): MathVersion {
  const { math } = text;
  const draws = Array.from({ length: MAX_NEW_NUMBER_TRIES }, () => drawValues(math, random));

  const found = draws
    .map((values) => ({ result: evaluateFormula(math.solution, values), values }))
    .find(
      (draw) =>
        draw.result.ok && isUsableDraw({ entry, math, otherSolutions, values: draw.values }),
    );

  if (!found?.result.ok) {
    return checkedVersion(text);
  }

  return fillMathVersion({ ...text, answer: found.result.value, values: found.values });
}

export function checkMathAnswer({
  answer,
  entry = ANY_NUMBER,
  math,
  otherSolutions,
  values,
}: AnswerRules & { answer: number; math: GeneratedMathProblem; values: Readonly<MathValues> }): {
  isCorrect: boolean;
  mistake: GeneratedMathProblem["commonMistakes"][number] | null;
} {
  const accepted = [math.solution, ...(otherSolutions ?? [])].flatMap((expression) => {
    const result = evaluateFormula(expression, values);
    return result.ok ? [result.value] : [];
  });

  if (
    accepted.some((expected) =>
      matchesEntry({ entry, expected, tolerance: math.tolerance, value: answer }),
    )
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
