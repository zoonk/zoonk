const MAX_ROUND_DIGITS = 10;
const HALF_TURN_DEGREES = 180;

type ExpressionFunctionSpec = {
  apply: (args: readonly number[]) => number;
  maxArgs: number;
  minArgs: number;
};

function unary(apply: (value: number) => number): ExpressionFunctionSpec {
  return { apply: (args) => apply(args[0] ?? Number.NaN), maxArgs: 1, minArgs: 1 };
}

/**
 * Rounds like a calculator: `round(2.345, 2)` is 2.35. Digits must be a small whole number so a
 * generated formula can't ask for a precision JavaScript can't represent.
 */
function roundTo(args: readonly number[]): number {
  const value = args[0] ?? Number.NaN;
  const digits = args[1] ?? 0;

  if (!Number.isInteger(digits) || digits < 0 || digits > MAX_ROUND_DIGITS) {
    return Number.NaN;
  }

  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

/**
 * The whitelist is the only way a formula can call code. Everything is plain math on numbers, and
 * anything outside the domain (like `sqrt(-1)`) returns NaN, which evaluation reports as an error.
 * `log` is the natural logarithm, as in JavaScript and Python; `log10` and `log2` are explicit.
 */
export const expressionFunctions = {
  abs: unary(Math.abs),
  acos: unary(Math.acos),
  asin: unary(Math.asin),
  atan: unary(Math.atan),
  cbrt: unary(Math.cbrt),
  ceil: unary(Math.ceil),
  cos: unary(Math.cos),
  deg: unary((radians) => (radians * HALF_TURN_DEGREES) / Math.PI),
  exp: unary(Math.exp),
  floor: unary(Math.floor),
  ln: unary(Math.log),
  log: unary(Math.log),
  log10: unary(Math.log10),
  log2: unary(Math.log2),
  max: { apply: (args) => Math.max(...args), maxArgs: Number.POSITIVE_INFINITY, minArgs: 1 },
  min: { apply: (args) => Math.min(...args), maxArgs: Number.POSITIVE_INFINITY, minArgs: 1 },
  rad: unary((degrees) => (degrees * Math.PI) / HALF_TURN_DEGREES),
  round: { apply: roundTo, maxArgs: 2, minArgs: 1 },
  sign: unary(Math.sign),
  sin: unary(Math.sin),
  sqrt: unary(Math.sqrt),
  tan: unary(Math.tan),
} satisfies Record<string, ExpressionFunctionSpec>;

export type ExpressionFunctionName = keyof typeof expressionFunctions;

const expressionConstants = [
  ["e", Math.E],
  ["pi", Math.PI],
] as const;

export type ExpressionConstantName = (typeof expressionConstants)[number][0];

export function isExpressionFunctionName(name: string): name is ExpressionFunctionName {
  return Object.hasOwn(expressionFunctions, name);
}

export function isExpressionConstantName(name: string): name is ExpressionConstantName {
  return expressionConstants.some(([constant]) => constant === name);
}

export function expressionConstantValue(name: ExpressionConstantName): number {
  return expressionConstants.find(([constant]) => constant === name)?.[1] ?? Number.NaN;
}
