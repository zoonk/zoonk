import { snapToStep } from "../_utils/snap-value";

export type AngleUnit = "degrees" | "radians";

export const FULL_TURN = 360;
const HALF_TURN = 180;
/* oxlint-disable-next-line no-magic-numbers -- Steps a learner can land on, largest first. */
const ANGLE_STEPS = [5, 1] as const;
const FINE_STEP = 0.5;
const MULTIPLE_SLACK = 1e-3;
const PAGE_TURN = 45;
/* oxlint-disable-next-line no-magic-numbers -- Denominators of the angles people write with π. */
const PI_DENOMINATORS = [1, 2, 3, 4, 6, 12] as const;
const PI_SLACK = 1e-6;

export function toDegrees(angle: number, unit: AngleUnit): number {
  return unit === "degrees" ? angle : (angle * HALF_TURN) / Math.PI;
}

export function fromDegrees(degrees: number, unit: AngleUnit): number {
  return unit === "degrees" ? degrees : (degrees * Math.PI) / HALF_TURN;
}

function isMultiple(value: number, step: number): boolean {
  const ratio = value / step;
  return Math.abs(ratio - Math.round(ratio)) < MULTIPLE_SLACK;
}

/**
 * The step the point moves in, in degrees: 5° when every angle the lesson names sits on it (so
 * the check's angle can be reached exactly), finer otherwise.
 */
export function angleStep(anglesInDegrees: readonly number[]): number {
  return (
    ANGLE_STEPS.find((step) => anglesInDegrees.every((angle) => isMultiple(angle, step))) ??
    FINE_STEP
  );
}

export function snapAngle(degrees: number, step: number): number {
  return snapToStep(degrees, { max: FULL_TURN, min: 0, step });
}

/** The angle of a screen point around the center, counterclockwise from the right like on paper. */
export function pointerAngle(
  center: { x: number; y: number },
  pixel: { x: number; y: number },
): number {
  const degrees = (Math.atan2(center.y - pixel.y, pixel.x - center.x) * HALF_TURN) / Math.PI;
  return degrees < 0 ? degrees + FULL_TURN : degrees;
}

/** Arrows turn one step (right and up turn counterclockwise), Page keys an eighth of a turn. */
export function angleAfterKey({
  degrees,
  key,
  step,
}: {
  degrees: number;
  key: string;
  step: number;
}): number | null {
  const turns: Record<string, number> = {
    ArrowDown: -step,
    ArrowLeft: -step,
    ArrowRight: step,
    ArrowUp: step,
    End: FULL_TURN,
    Home: -FULL_TURN,
    PageDown: -PAGE_TURN,
    PageUp: PAGE_TURN,
  };

  const turn = turns[key];
  return turn === undefined ? null : snapAngle(degrees + turn, step);
}

/**
 * An angle in radians as the multiple of π people write, like "5π/6" or "2π", when it is one;
 * null otherwise, so the caller shows a decimal.
 */
export function piFraction(degrees: number): string | null {
  const turns = degrees / HALF_TURN;

  const denominator = PI_DENOMINATORS.find(
    (candidate) => Math.abs(turns * candidate - Math.round(turns * candidate)) < PI_SLACK,
  );

  if (denominator === undefined) {
    return null;
  }

  const numerator = Math.round(turns * denominator);

  if (numerator === 0) {
    return "0";
  }

  const top = numerator === 1 ? "π" : `${numerator}π`;
  return denominator === 1 ? top : `${top}/${denominator}`;
}
