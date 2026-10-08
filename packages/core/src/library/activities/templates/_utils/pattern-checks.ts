import { type ActivityFormulaExample } from "../../activity-expected-answer";
import { type ActivityTolerance } from "../../activity-schemas";
import { characters, evaluateOrNull, isClose } from "./template-helpers";

export const MAX_PATTERN_LENGTH = 200;

type ScanState = {
  closedRiskyGroup: boolean;
  escaped: boolean;
  groups: boolean[];
  inClass: boolean;
  unsafe: boolean;
};

function markInnermost(groups: readonly boolean[]): boolean[] {
  return groups.length === 0 ? [...groups] : [...groups.slice(0, -1), true];
}

function isRepeat(char: string): boolean {
  return char === "*" || char === "+" || char === "{";
}

function closeGroup(state: ScanState): ScanState {
  const risky = state.groups.at(-1) ?? false;
  const outer = state.groups.slice(0, -1);

  return { ...state, closedRiskyGroup: risky, groups: risky ? markInnermost(outer) : outer };
}

function scanPlainChar(state: ScanState, char: string): ScanState {
  const plain = { ...state, closedRiskyGroup: false };

  if (char === "[") {
    return { ...plain, inClass: true };
  }

  if (char === "(") {
    return { ...plain, groups: [...state.groups, false] };
  }

  if (char === ")") {
    return closeGroup(state);
  }

  if (isRepeat(char)) {
    return state.closedRiskyGroup
      ? { ...state, unsafe: true }
      : { ...plain, groups: markInnermost(state.groups) };
  }

  return char === "|" ? { ...plain, groups: markInnermost(state.groups) } : plain;
}

function scanChar(state: ScanState, char: string): ScanState {
  if (state.unsafe) {
    return state;
  }

  if (state.escaped) {
    return { ...state, closedRiskyGroup: false, escaped: false };
  }

  if (char === "\\") {
    return { ...state, closedRiskyGroup: false, escaped: true };
  }

  if (state.inClass) {
    return { ...state, closedRiskyGroup: false, inClass: char !== "]" };
  }

  return scanPlainChar(state, char);
}

/**
 * Compiles a pattern only when it can't backtrack for exponential time: a repeated group that
 * itself repeats or alternates (like `(a+)+` or `(a|aa)*`) is refused, as are backreferences.
 * Lesson patterns never need either, and this keeps grading safe on the server.
 */
export function compileSafeRegex(pattern: string): RegExp | null {
  const initial: ScanState = {
    closedRiskyGroup: false,
    escaped: false,
    groups: [],
    inClass: false,
    unsafe: false,
  };

  const scanned = characters(pattern).reduce((state, char) => scanChar(state, char), initial);

  if (pattern.length > MAX_PATTERN_LENGTH || scanned.unsafe || /\\[1-9k]/u.test(pattern)) {
    return null;
  }

  try {
    return new RegExp(pattern, "u");
  } catch {
    return null;
  }
}

export function regexPassesExamples(
  pattern: string,
  examples: { shouldMatch: readonly string[]; shouldNotMatch: readonly string[] },
): boolean {
  const regex = compileSafeRegex(pattern);

  return (
    regex !== null &&
    examples.shouldMatch.every((sample) => regex.test(sample)) &&
    !examples.shouldNotMatch.some((sample) => regex.test(sample))
  );
}

export function withinTolerance({
  expected,
  tolerance,
  value,
}: {
  expected: number;
  tolerance: ActivityTolerance;
  value: number;
}): boolean {
  const allowed =
    tolerance.kind === "absolute" ? tolerance.value : tolerance.value * Math.abs(expected);

  return Math.abs(value - expected) <= allowed || isClose(value, expected);
}

/** Spreadsheet formulas start with "=", which the expression language doesn't need. */
function stripFormulaSign(formula: string): string {
  return formula.trim().replace(/^=/u, "");
}

export function formulaPassesExamples(
  formula: string,
  expected: { examples: readonly ActivityFormulaExample[]; tolerance: ActivityTolerance },
): boolean {
  return expected.examples.every((example) => {
    const value = evaluateOrNull(stripFormulaSign(formula), example.inputs);

    return (
      value !== null &&
      withinTolerance({ expected: example.output, tolerance: expected.tolerance, value })
    );
  });
}
