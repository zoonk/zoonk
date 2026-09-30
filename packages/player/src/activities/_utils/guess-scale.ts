import { niceTicks } from "./plot-scale";
import { clamp } from "./snap-value";

/** Slider positions along the scale: fine enough to feel continuous, coarse enough for arrows. */
export const SCALE_POSITIONS = 200;

const GUESS_DIGITS = 2;
const CLOSE_RATIO = 1.5;
const MAX_LOG_TICKS = 6;
const LINEAR_TICKS = 4;
/** Round labels this close to an end would crowd the end's own label. */
const END_ROOM = 0.08;

export type GuessScale = { max: number; min: number; scale: "linear" | "log" };

/** The value at a slider position. A log scale gives each power of ten the same room. */
export function valueAtPosition({ max, min, scale }: GuessScale, position: number): number {
  const share = clamp(position, 0, SCALE_POSITIONS) / SCALE_POSITIONS;

  if (scale === "log") {
    return 10 ** (Math.log10(min) + (Math.log10(max) - Math.log10(min)) * share);
  }

  return min + (max - min) * share;
}

/** Where a value sits on the scale, from 0 to 1, clamped to the ends. */
export function shareOfValue({ max, min, scale }: GuessScale, value: number): number {
  if (scale === "log") {
    const share =
      (Math.log10(Math.max(value, min)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));

    return clamp(share, 0, 1);
  }

  return max === min ? 0 : clamp((value - min) / (max - min), 0, 1);
}

/** A guess reads as a guess: two significant digits, like 3,000 or 0.25, never 2,871.3. */
export function roundGuess(value: number): number {
  return value === 0 ? 0 : Number(value.toPrecision(GUESS_DIGITS));
}

/**
 * Labels along the scale: powers of ten on a log scale; on a linear one both ends (where the
 * learner can go) with round steps between them.
 */
export function scaleTicks({ max, min, scale }: GuessScale): number[] {
  if (scale === "linear") {
    const room = (max - min) * END_ROOM;

    const inside = niceTicks([min, max], LINEAR_TICKS).filter(
      (tick) => tick - min > room && max - tick > room,
    );

    return [min, ...inside, max];
  }

  const [from, to] = [Math.ceil(Math.log10(min)), Math.floor(Math.log10(max))];

  const powers = Array.from(
    { length: Math.max(to - from + 1, 0) },
    (_, index) => 10 ** (from + index),
  );

  const every = Math.ceil(powers.length / MAX_LOG_TICKS);

  return powers.length < 2 ? [min, max] : powers.filter((_, index) => index % every === 0);
}

type GuessComparison =
  | { kind: "close" }
  | { kind: "tooBig"; times: number }
  | { kind: "tooSmall"; times: number }
  | { difference: number; kind: "off" };

/**
 * How a guess compares with the real value, in the terms people use for estimates: close, or
 * how many times too big or too small. Without a ratio (zero or mixed signs) it's the difference.
 */
export function compareGuess(guess: number, actual: number): GuessComparison {
  if (guess <= 0 || actual <= 0) {
    return guess === actual ? { kind: "close" } : { difference: guess - actual, kind: "off" };
  }

  const ratio = guess / actual;

  if (ratio >= CLOSE_RATIO) {
    return { kind: "tooBig", times: roundGuess(ratio) };
  }

  return ratio <= 1 / CLOSE_RATIO
    ? { kind: "tooSmall", times: roundGuess(1 / ratio) }
    : { kind: "close" };
}
