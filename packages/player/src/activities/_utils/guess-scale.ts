import { niceTicks } from "@zoonk/utils/plot-scale";
import { clamp } from "./snap-value";

export const SCALE_POSITIONS = 200;

const GUESS_DIGITS = 2;
const RATIO_COMPARISON_MIN = 1.5;
const MAX_LOG_TICKS = 6;
const LINEAR_TICKS = 4;
const END_ROOM = 0.08;

export type GuessScale = { max: number; min: number; scale: "linear" | "log" };

export function valueAtPosition({ max, min, scale }: GuessScale, position: number): number {
  const share = clamp(position, 0, SCALE_POSITIONS) / SCALE_POSITIONS;

  if (scale === "log") {
    return 10 ** (Math.log10(min) + (Math.log10(max) - Math.log10(min)) * share);
  }

  return min + (max - min) * share;
}

export function shareOfValue({ max, min, scale }: GuessScale, value: number): number {
  if (scale === "log") {
    const share =
      (Math.log10(Math.max(value, min)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min));

    return clamp(share, 0, 1);
  }

  return max === min ? 0 : clamp((value - min) / (max - min), 0, 1);
}

export function roundGuess(value: number): number {
  return value === 0 ? 0 : Number(value.toPrecision(GUESS_DIGITS));
}

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

export function compareGuess({
  actual,
  guess,
  isCorrect,
}: {
  actual: number;
  guess: number;
  isCorrect: boolean;
}): GuessComparison {
  if (isCorrect) {
    return { kind: "close" };
  }

  if (guess <= 0 || actual <= 0) {
    return { difference: guess - actual, kind: "off" };
  }

  const ratio = guess / actual;

  if (ratio >= RATIO_COMPARISON_MIN) {
    return { kind: "tooBig", times: roundGuess(ratio) };
  }

  return ratio <= 1 / RATIO_COMPARISON_MIN
    ? { kind: "tooSmall", times: roundGuess(1 / ratio) }
    : { difference: guess - actual, kind: "off" };
}
