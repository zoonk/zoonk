import { hashSeed } from "@zoonk/utils/seeded-random";

/**
 * The order a question's entries are shown in: shuffled, but the same every time it's shown, so
 * an answer can be graded against it without storing anything. Never the entries' own order,
 * which would give the answer away. Each value is the index of the stored entry shown there.
 */
export function getShownOrder({ count, seed }: { count: number; seed: string }): number[] {
  const indexes = Array.from({ length: count }, (_, index) => index);
  const shuffled = indexes.toSorted((a, b) => hashSeed(`${seed}:${a}`) - hashSeed(`${seed}:${b}`));
  const unchanged = shuffled.every((value, index) => value === index);

  return unchanged ? [...shuffled.slice(1), ...shuffled.slice(0, 1)] : shuffled;
}
