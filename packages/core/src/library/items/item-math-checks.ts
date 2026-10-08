import { type GeneratedMathProblem } from "@zoonk/ai/tasks/v2/items/schemas";
import { evaluateFormula } from "../activities/expression/evaluate-expression";
import { parseExpression } from "../activities/expression/parse-expression";
import { sampleExpression } from "../activities/expression/sample-expression";
import { withinTolerance } from "../activities/templates/_utils/pattern-checks";
import {
  type MathValues,
  RESULT_PLACEHOLDER,
  getPlaceholders,
  getValues,
} from "./_utils/math-values";

const NUMBER_IN_TEXT = /(?<![\w.,])\d+(?:[.,]\d+)?(?![\w])/gu;
const PLACEHOLDER_TEXT = /\{[A-Z_a-z]\w*\}/gu;

type Problem = string | false;

const EXACT = { kind: "absolute", value: 0 } as const;

/** Problems with one expression: it must parse, use only declared variables and evaluate. */
function checkExpression({
  declared,
  expression,
  label,
  values,
}: {
  declared: ReadonlySet<string>;
  expression: string;
  label: string;
  values: MathValues;
}): { problems: string[]; value: number | null } {
  const parsed = parseExpression(expression);

  if (!parsed.ok) {
    return { problems: [`${label} doesn't parse: ${parsed.error.message}.`], value: null };
  }

  const unknown = parsed.expression.variables.filter((name) => !declared.has(name));

  if (unknown.length > 0) {
    return { problems: [`${label} uses undeclared ${unknown.join(", ")}.`], value: null };
  }

  const result = evaluateFormula(expression, values);

  return result.ok
    ? { problems: [], value: result.value }
    : { problems: [`${label} fails: ${result.error}.`], value: null };
}

function checkVariables(math: GeneratedMathProblem, shownText: string): Problem[] {
  const names = math.variables.map((variable) => variable.name);
  const declared = new Set(names);
  const shown = new Set(getPlaceholders(shownText));

  return [
    declared.size !== names.length && "Two variables share a name.",
    declared.has(RESULT_PLACEHOLDER) && `A variable uses the reserved name ${RESULT_PLACEHOLDER}.`,
    ...math.variables.flatMap((variable) => [
      (variable.value < variable.min || variable.value > variable.max) &&
        `Variable ${variable.name} is outside its range.`,
      variable.step <= 0 && `Variable ${variable.name} has no positive step.`,
      !shown.has(variable.name) && `The question never shows ${variable.name}.`,
    ]),
    ...[...shown]
      .filter((name) => !declared.has(name))
      .map((name) => `The question shows undeclared {${name}}.`),
  ];
}

function checkMistakes(
  math: GeneratedMathProblem,
  context: { correct: number; declared: ReadonlySet<string>; values: MathValues },
): Problem[] {
  return math.commonMistakes.flatMap((mistake, index) => {
    const label = `Common mistake ${index + 1}`;
    const checked = checkExpression({ ...context, expression: mistake.expression, label });

    return [
      ...checked.problems,
      checked.value !== null &&
        withinTolerance({
          expected: context.correct,
          tolerance: math.tolerance,
          value: checked.value,
        }) &&
        `${label} gives the correct answer.`,
      (!mistake.misconception.trim() || !mistake.reason.trim()) && `${label} has no reason.`,
    ];
  });
}

function getNumbersInText(text: string): number[] {
  return [...text.replaceAll(PLACEHOLDER_TEXT, " ").matchAll(NUMBER_IN_TEXT)].map((match) =>
    Number(match[0].replace(",", ".")),
  );
}

/**
 * New versions change every computed value, so a step that types one ("the
 * discount is R$ 45") would be wrong next time. Numbers that are also a
 * variable's value can't be told apart and are allowed.
 */
function findFixedNumber({
  computed,
  text,
  values,
}: {
  computed: readonly number[];
  text: string;
  values: MathValues;
}): number | null {
  const variableValues = Object.values(values);

  return (
    getNumbersInText(text).find(
      (number) =>
        computed.some((value) =>
          withinTolerance({ expected: value, tolerance: EXACT, value: number }),
        ) && !variableValues.includes(number),
    ) ?? null
  );
}

function checkStep({
  context,
  index,
  step,
}: {
  context: { answer: number; declared: ReadonlySet<string>; values: MathValues };
  index: number;
  step: GeneratedMathProblem["steps"][number];
}): Problem[] {
  const label = `Step ${index + 1}`;
  const placeholders = getPlaceholders(step.text);

  const checked = step.expression
    ? checkExpression({ ...context, expression: step.expression, label })
    : { problems: [], value: null };

  const computed = [context.answer, ...(checked.value === null ? [] : [checked.value])];
  const fixedNumber = findFixedNumber({ computed, text: step.text, values: context.values });

  return [
    ...placeholders
      .filter((name) => name !== RESULT_PLACEHOLDER && !context.declared.has(name))
      .map((name) => `${label} shows undeclared {${name}}.`),
    placeholders.includes(RESULT_PLACEHOLDER) &&
      !step.expression &&
      `${label} shows {${RESULT_PLACEHOLDER}} without an expression.`,
    ...checked.problems,
    fixedNumber !== null && `${label} types the computed ${fixedNumber} instead of a placeholder.`,
  ];
}

/**
 * Recomputes a math item from its data: the solution must give the stated
 * answer, work for every value a new version can draw and differ from each
 * common mistake, and worked steps must use placeholders for anything
 * computed. That is what lets code grade answers and make new numbers.
 */
export function checkMathProblem({
  context = null,
  math,
  question,
}: {
  /** The support text, which can show variables too. */
  context?: string | null;
  math: GeneratedMathProblem;
  question: string;
}): string[] {
  const shownText = [context, question].filter(Boolean).join("\n");
  const declared = new Set(math.variables.map((variable) => variable.name));
  const values = getValues(math);

  const solution = checkExpression({
    declared,
    expression: math.solution,
    label: "The solution",
    values,
  });

  if (solution.value === null) {
    return [...checkVariables(math, shownText), ...solution.problems].filter(
      (problem) => typeof problem === "string",
    );
  }

  const correct = solution.value;
  const sampled = sampleExpression({ expression: math.solution, ranges: math.variables });

  return [
    ...checkVariables(math, shownText),
    math.tolerance.value < 0 && "The tolerance is negative.",
    !withinTolerance({ expected: correct, tolerance: math.tolerance, value: math.answer }) &&
      `The stated answer ${math.answer} doesn't match the computed ${correct}.`,
    !sampled.ok && `The solution fails for new numbers: ${sampled.error}.`,
    math.commonMistakes.length === 0 && "Has no common mistakes.",
    ...checkMistakes(math, { correct, declared, values }),
    ...math.steps.flatMap((step, index) =>
      checkStep({ context: { answer: correct, declared, values }, index, step }),
    ),
  ].filter((problem) => typeof problem === "string");
}
