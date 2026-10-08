import { snapToStep } from "../_utils/snap-value";

/* oxlint-disable-next-line no-magic-numbers -- These are the round split steps themselves. */
const DECIMAL_STEPS = [1, 0.5, 0.25, 0.1, 0.05, 0.01] as const;
const FLOAT_SLACK = 1e-9;

/** Where the split lines sit: the running total of every part but the last. */
export function partsToCuts(parts: readonly number[]): number[] {
  return parts.slice(0, -1).reduce<number[]>((cuts, part) => {
    cuts.push((cuts.at(-1) ?? 0) + part);
    return cuts;
  }, []);
}

/** The parts between split lines, from the start of the side to its total. */
export function cutsToParts(cuts: readonly number[], total: number): number[] {
  const edges = [0, ...cuts, total];

  return edges.slice(1).map((edge, index) => Number((edge - (edges[index] ?? 0)).toPrecision(12)));
}

function isMultiple(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < FLOAT_SLACK;
}

/**
 * The finest round step that still reaches every split the writer chose: whole numbers when the
 * parts are whole, otherwise halves, quarters, tenths and so on.
 */
export function splitStep(parts: readonly number[]): number {
  return (
    DECIMAL_STEPS.find((step) => parts.every((part) => isMultiple(part, step))) ??
    DECIMAL_STEPS.at(-1) ??
    1
  );
}

/**
 * Moves one split line, keeping it at least a step away from its neighbors and the edges, so a
 * part can shrink to one step but never vanish or swap places with the next.
 */
export function moveCut({
  cuts,
  index,
  step,
  total,
  value,
}: {
  cuts: readonly number[];
  index: number;
  step: number;
  total: number;
  value: number;
}): number[] {
  const min = (cuts[index - 1] ?? 0) + step;
  const max = (cuts[index + 1] ?? total) - step;

  if (min > max) {
    return [...cuts];
  }

  return cuts.map((cut, position) =>
    position === index ? snapToStep(value, { max, min, step }) : cut,
  );
}
