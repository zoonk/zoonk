import { evaluateFormula } from "@zoonk/core/library/activities/expression/evaluate";

export type Pan = { units: number; x: number };
export type BalanceState = { left: Pan; right: Pan };
export type PanSide = keyof BalanceState;

export type BalanceMove =
  | { kind: "split"; groups: number }
  | { kind: "takeUnit"; side: PanSide }
  | { kind: "takeX"; side: PanSide };

const MAX_BAGS = 6;
const MAX_BLOCKS = 12;
const MAX_TILT_DEGREES = 9;
const SLACK = 1e-9;

function evaluateAt(expression: string, variable: string, value: number): number | null {
  const result = evaluateFormula(expression, { [variable]: value });
  return result.ok ? result.value : null;
}

function linearPan(expression: string, variable: string): Pan | null {
  const atZero = evaluateAt(expression, variable, 0);
  const atOne = evaluateAt(expression, variable, 1);
  const atTwo = evaluateAt(expression, variable, 2);

  if (atZero === null || atOne === null || atTwo === null) {
    return null;
  }

  const slope = atOne - atZero;
  return Math.abs(atTwo - (atZero + 2 * slope)) < SLACK ? { units: atZero, x: slope } : null;
}

export function parseBalance(
  equation: { left: string; right: string },
  variable: string,
): BalanceState | null {
  const [left, right] = [linearPan(equation.left, variable), linearPan(equation.right, variable)];
  return left && right ? { left, right } : null;
}

export function solveBalance({ left, right }: BalanceState): number | null {
  const slope = left.x - right.x;
  return Math.abs(slope) < SLACK ? null : (right.units - left.units) / slope;
}

function isCountable(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= max;
}

export function canDrawBlocks(state: BalanceState, solution: number | null): boolean {
  const pans = [state.left, state.right];

  return (
    solution !== null &&
    solution > 0 &&
    pans.every((pan) => isCountable(pan.x, MAX_BAGS) && isCountable(pan.units, MAX_BLOCKS)) &&
    pans.some((pan) => pan.x > 0)
  );
}

function panWeight(pan: Pan, solution: number): number {
  return pan.x * solution + pan.units;
}

export function tiltDegrees(state: BalanceState, solution: number): number {
  const [left, right] = [panWeight(state.left, solution), panWeight(state.right, solution)];
  const heavier = Math.max(left, right);

  if (heavier <= 0 || Math.abs(right - left) < SLACK) {
    return 0;
  }

  return ((right - left) / heavier) * MAX_TILT_DEGREES;
}

export function splitGroups({ left, right }: BalanceState): number | null {
  const [bags, blocks] = left.x > 0 ? [left, right] : [right, left];
  return bags.x > 1 && bags.units === 0 && blocks.x === 0 ? bags.x : null;
}

function take(pan: Pan, key: keyof Pan): Pan {
  return pan[key] > 0 ? { ...pan, [key]: pan[key] - Math.min(pan[key], 1) } : pan;
}

export function applyMove(state: BalanceState, move: BalanceMove): BalanceState {
  if (move.kind === "split") {
    const divide = (pan: Pan): Pan => ({ units: pan.units / move.groups, x: pan.x / move.groups });
    return { left: divide(state.left), right: divide(state.right) };
  }

  const key = move.kind === "takeX" ? "x" : "units";
  return { ...state, [move.side]: take(state[move.side], key) };
}

export function isolatedValue({ left, right }: BalanceState): number | null {
  if (left.x === 1 && left.units === 0 && right.x === 0) {
    return right.units;
  }

  return right.x === 1 && right.units === 0 && left.x === 0 ? left.units : null;
}

function samePan(first: Pan, second: Pan): boolean {
  return Math.abs(first.x - second.x) < SLACK && Math.abs(first.units - second.units) < SLACK;
}

function matchesState(state: BalanceState, step: BalanceState): boolean {
  return (
    (samePan(state.left, step.left) && samePan(state.right, step.right)) ||
    (samePan(state.left, step.right) && samePan(state.right, step.left))
  );
}

export function reachedSteps({
  current,
  history,
  solution,
  steps,
}: {
  current: BalanceState;
  history: readonly BalanceState[];
  solution: number;
  steps: readonly (BalanceState | null)[];
}): number {
  const isolated = isolatedValue(current);

  if (isolated !== null && Math.abs(isolated - solution) < SLACK) {
    return steps.length;
  }

  const visited = [...history, current];

  return steps.reduce<number>(
    (reached, step, index) =>
      reached === index && step && visited.some((state) => matchesState(state, step))
        ? reached + 1
        : reached,
    0,
  );
}

export function panText(pan: Pan, symbol: string, format: (value: number) => string): string {
  const unknown = pan.x === 0 ? "" : `${pan.x === 1 ? "" : format(pan.x)}${symbol}`;
  const units = pan.units === 0 && unknown ? "" : format(pan.units);

  return [unknown, units].filter(Boolean).join(" + ");
}
