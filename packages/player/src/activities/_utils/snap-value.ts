export type SnapRange = { max: number; min: number; step: number };

const MULTIPLE_SLACK = 1e-9;

/** Keys that move a place handle, and how many steps each one moves. */
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

/** Whether a value is a whole number of steps, allowing for float noise. */
export function isMultiple(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < MULTIPLE_SLACK * Math.max(1, Math.abs(ratio));
}

/**
 * Snaps to the nearest position the learner can reach (min plus a whole number of steps), so a
 * dragged value lands exactly where keyboard steps would, without float noise like 0.30000000004.
 */
export function snapToStep(value: number, { max, min, step }: SnapRange): number {
  const steps = Math.round((clamp(value, min, max) - min) / step);
  const snapped = Number((min + steps * step).toPrecision(12));

  return clamp(snapped, min, max);
}

/**
 * The value after a key press, like a native slider: arrows move one step, Page Up/Down ten,
 * Home/End jump to the ends. Returns null for keys that don't move the handle.
 */
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
