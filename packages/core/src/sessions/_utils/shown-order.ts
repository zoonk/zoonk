import { seededShuffle } from "@zoonk/utils/seeded-random";

/** Returns stored-entry indexes in stable shuffled display order; grading must use this order. */
export function getShownOrder({ count, seed }: { count: number; seed: string }): number[] {
  const indexes = Array.from({ length: count }, (_, index) => index);
  const shuffled = seededShuffle(indexes, seed);
  const unchanged = shuffled.every((value, index) => value === index);

  return unchanged ? [...shuffled.slice(1), ...shuffled.slice(0, 1)] : shuffled;
}
