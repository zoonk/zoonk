export type SnapRange = { max: number; min: number; step: number };

const MULTIPLE_SLACK = 1e-9;

const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowDown: -1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -10,
  PageUp: 10,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isMultiple(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < MULTIPLE_SLACK * Math.max(1, Math.abs(ratio));
}

export function snapToStep(value: number, { max, min, step }: SnapRange): number {
  const steps = Math.round((clamp(value, min, max) - min) / step);
  const snapped = Number((min + steps * step).toPrecision(12));

  return clamp(snapped, min, max);
}

export function valueAfterKey(key: string, value: number, range: SnapRange): number | null {
  if (key === "Home") {
    return range.min;
  }

  if (key === "End") {
    return range.max;
  }

  const steps = KEY_STEPS[key];

  return steps === undefined ? null : snapToStep(value + steps * range.step, range);
}
