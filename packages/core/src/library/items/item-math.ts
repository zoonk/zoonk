import { type GeneratedMathProblem, type NumericEntry } from "@zoonk/ai/tasks/items/schemas";
import { evaluateExpression, evaluateFormula } from "../activities/expression/evaluate-expression";
import {
  type ExpressionNode,
  type ParsedExpression,
  getSubexpressions,
  parseExpression,
} from "../activities/expression/parse-expression";
import { withinTolerance } from "../activities/templates/_utils/pattern-checks";
import { type MathValues, fillMathStep, fillMathText, getValues } from "./_utils/math-values";
import { ANY_NUMBER, fitsEntry, isWholeNumber, matchesEntry } from "./_utils/numeric-entry";

const MAX_NEW_NUMBER_TRIES = 50;
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

type Computed = { expression: ParsedExpression; keepsWhole: boolean; written: number };

const ROUNDING = new Set(["ceil", "floor", "round"]);

/** What a rounding call rounds may be fractional: rounding it is how the writer said so. */
function getRounded(expressions: readonly ParsedExpression[]): Set<ExpressionNode> {
  return new Set(
    expressions.flatMap(({ ast }) =>
      ast.kind === "call" && ROUNDING.has(ast.name) && ast.args[0] ? [ast.args[0]] : [],
    ),
  );
}

function getComputed(math: GeneratedMathProblem): Computed[] {
  const values = getValues(math);

  const expressions = [
    math.solution,
    ...math.steps.flatMap((step) => step.expression ?? []),
  ].flatMap((source) => {
    const parsed = parseExpression(source);
    return parsed.ok ? getSubexpressions(parsed.expression) : [];
  });

  const rounded = getRounded(expressions);

  return expressions.flatMap((expression) => {
    const result = evaluateExpression(expression, values);

    return result.ok
      ? [{ expression, keepsWhole: !rounded.has(expression.ast), written: result.value }]
      : [];
  });
}

/**
 * Code can't tell a count (customers) from a measure (money), so every value the solution or a
 * step computes, shown or not, keeps its sign (a net yield never turns negative) and stays whole
 * when it's whole in the written question.
 */
function keepsWrittenForm({
  computed,
  values,
}: {
  computed: readonly Computed[];
  values: MathValues;
}): boolean {
  return computed.every(({ expression, keepsWhole, written }) => {
    const result = evaluateExpression(expression, values);

    return (
      result.ok &&
      Math.sign(toDecimal(result.value)) === Math.sign(toDecimal(written)) &&
      (!keepsWhole || !isWholeNumber(written) || isWholeNumber(result.value))
    );
  });
}

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
  computed,
  entry,
  math,
  otherSolutions,
  values,
}: {
  computed: readonly Computed[];
  entry: NumericEntry;
  math: GeneratedMathProblem;
  otherSolutions?: readonly string[];
  values: MathValues;
}): boolean {
  const accepted = getAcceptedValues({ math, otherSolutions, values });

  return (
    accepted !== null &&
    accepted.every((value) => fitsEntry({ entry, value })) &&
    keepsWrittenForm({ computed, values }) &&
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
  const computed = getComputed(math);
  const draws = Array.from({ length: MAX_NEW_NUMBER_TRIES }, () => drawValues(math, random));

  const found = draws
    .map((values) => ({ result: evaluateFormula(math.solution, values), values }))
    .find(
      (draw) =>
        draw.result.ok &&
        isUsableDraw({ computed, entry, math, otherSolutions, values: draw.values }),
    );

  if (!found?.result.ok) {
    return checkedVersion(text);
  }

  return fillMathVersion({ ...text, answer: found.result.value, values: found.values });
}

export function withRecordedNumbers({
  values,
  ...text
}: MathText & { values: MathValues }): MathVersion | null {
  const solution = evaluateFormula(text.math.solution, values);
  return solution.ok ? fillMathVersion({ ...text, answer: solution.value, values }) : null;
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
