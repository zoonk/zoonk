import { type ActivityVariable } from "../../activity-schemas";
import {
  type ActivityCheckTarget,
  type ActivityIssue,
  type ActivityIssueCode,
} from "../../define-activity-template";
import { evaluateFormula } from "../../expression/evaluate-expression";

/** Floating-point slack so 0.1 + 0.2 still equals 0.3 when code compares computed numbers. */
const FLOAT_SLACK = 1e-9;

/** Sliders with more positions than this can't be moved precisely on a phone. */
const MAX_SLIDER_POSITIONS = 1000;

export function issue(code: ActivityIssueCode, path: string, message: string): ActivityIssue {
  return { code, message, path };
}

export function isClose(value: number, expected: number, slack = FLOAT_SLACK): boolean {
  return Math.abs(value - expected) <= slack * Math.max(1, Math.abs(expected));
}

/** A string's UTF-16 characters. Patterns and genotypes are ASCII, so no grapheme handling is needed. */
export function characters(text: string): string[] {
  return Array.from({ length: text.length }, (_, index) => text.charAt(index));
}

export function evaluateOrNull(formula: string, values: Readonly<Record<string, number>> = {}) {
  const result = evaluateFormula(formula, values);
  return result.ok ? result.value : null;
}

/** Issues for anything listed twice, like two items with one id. */
export function duplicateIssues(
  values: readonly string[],
  path: string,
  what: string,
): ActivityIssue[] {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);

  return [...new Set(duplicates)].map((value) =>
    issue("inconsistentFields", path, `${what} "${value}" appears more than once`),
  );
}

/**
 * A scale the learner guesses on: it needs a range, a log scale starts above zero, and the true
 * value must sit on it.
 */
export function guessScaleIssues(params: {
  max: number;
  min: number;
  scale: "linear" | "log";
  trueValue: number | null;
  trueValuePath: string;
}): ActivityIssue[] {
  const { max, min, trueValue } = params;

  return [
    max <= min && issue("missingInteraction", "fields", "The scale has no range"),
    params.scale === "log" &&
      min <= 0 &&
      issue("inconsistentFields", "fields.min", "A log scale must start above zero"),
    trueValue !== null &&
      (trueValue < min || trueValue > max) &&
      issue("inconsistentFields", params.trueValuePath, "The true value is outside the scale"),
  ].filter((item) => item !== false);
}

/**
 * A slider that can't move is decoration: the range must be real, the start inside it and the
 * step small enough to give the learner positions to explore.
 */
export function variableIssues(variable: ActivityVariable, path: string): ActivityIssue[] {
  const positions = (variable.max - variable.min) / variable.step;

  return [
    variable.max <= variable.min &&
      issue("missingInteraction", path, `Slider "${variable.name}" has nothing to move`),
    (variable.initial < variable.min || variable.initial > variable.max) &&
      issue("inconsistentFields", path, `Slider "${variable.name}" starts outside its range`),
    variable.max > variable.min &&
      positions < 1 &&
      issue("missingInteraction", path, `Slider "${variable.name}" step is larger than its range`),
    positions > MAX_SLIDER_POSITIONS &&
      issue("inconsistentFields", path, `Slider "${variable.name}" step is too small to use`),
  ].filter((item) => item !== false);
}

/**
 * Slider values for a check: each variable starts at its initial value and the check's inputs
 * move it. An input that names no slider or falls outside its range can't be reached by the
 * learner, so there is no answer to compute.
 */
export function resolveSliderValues(
  variables: readonly ActivityVariable[],
  target: ActivityCheckTarget,
): Record<string, number> | null {
  const byName = new Map(variables.map((variable) => [variable.name, variable]));

  const isReachable = Object.entries(target.inputs).every(([name, value]) => {
    const variable = byName.get(name);
    return variable !== undefined && value >= variable.min && value <= variable.max;
  });

  if (!isReachable) {
    return null;
  }

  return {
    ...Object.fromEntries(variables.map((variable) => [variable.name, variable.initial])),
    ...target.inputs,
  };
}

/** A slider as an expression range, so formulas are sampled only where the learner can go. */
export function toRange(variable: ActivityVariable) {
  return { max: variable.max, min: variable.min, name: variable.name, step: variable.step };
}
