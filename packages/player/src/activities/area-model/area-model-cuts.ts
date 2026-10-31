import { isMultiple, snapToStep } from "../_utils/snap-value";

/* oxlint-disable-next-line no-magic-numbers -- These are the round split steps themselves. */
const DECIMAL_STEPS = [1, 0.5, 0.25, 0.1, 0.05, 0.01] as const;

export function partsToCuts(parts: readonly number[]): number[] {
  return parts.slice(0, -1).reduce<number[]>((cuts, part) => {
    cuts.push((cuts.at(-1) ?? 0) + part);
    return cuts;
  }, []);
}

export function cutsToParts(cuts: readonly number[], total: number): number[] {
  const edges = [0, ...cuts, total];

  return edges.slice(1).map((edge, index) => Number((edge - (edges[index] ?? 0)).toPrecision(12)));
}

export function splitStep(parts: readonly number[]): number {
  return (
    DECIMAL_STEPS.find((step) => parts.every((part) => isMultiple(part, step))) ??
    DECIMAL_STEPS.at(-1) ??
    1
  );
}

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
