/**
 * Fisher-Yates shuffle. Returns a new array without mutating the input.
 */
export function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = result[index];
    // oxlint-disable-next-line no-non-null-assertion -- index is guaranteed in-bounds by loop invariant
    result[index] = result[randomIndex]!;
    // oxlint-disable-next-line no-non-null-assertion -- temp holds a valid element from in-bounds index
    result[randomIndex] = temp!;
  }

  return result;
}
