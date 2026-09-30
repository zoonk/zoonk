export type Random = () => number;

/** The Park-Miller "minimal standard" generator: plain arithmetic that stays exact in doubles. */
const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;
const HASH_MULTIPLIER = 31;

/**
 * A small seeded generator. Simulations are reproducible from their seed, so the first run of a
 * lesson looks the same for everyone and in tests, and "Run again" just picks a new seed.
 */
export function seededRandom(seed: number): Random {
  const state = { value: (Math.abs(Math.floor(seed)) % (MODULUS - 1)) + 1 };

  return () => {
    state.value = (state.value * MULTIPLIER) % MODULUS;
    return (state.value - 1) / (MODULUS - 1);
  };
}

/** A stable number from text, for seeding a lesson's first run from its content. */
export function hashSeed(text: string): number {
  return Array.from({ length: text.length }, (_, index) => text.codePointAt(index) ?? 0).reduce(
    (hash, code) => (hash * HASH_MULTIPLIER + code) % MODULUS,
    0,
  );
}

/**
 * Shuffles items the same way for the same seed text, so a reload or a replay keeps everything
 * where it was, while the order the writer listed items in (often grouped by answer) never shows.
 */
export function seededShuffle<T>(items: readonly T[], seedText: string): T[] {
  const random = seededRandom(hashSeed(seedText));

  return items
    .map((item) => ({ item, key: random() }))
    .toSorted((first, second) => first.key - second.key)
    .map(({ item }) => item);
}

/** A standard normal draw (Box-Muller), from two uniform draws of the seeded generator. */
export function standardNormal(random: Random): number {
  const radius = Math.sqrt(-(2 * Math.log(1 - random())));
  return radius * Math.cos(2 * Math.PI * random());
}

/** How many of `trials` independent tries succeed, each with the given chance. */
export function binomialCount({
  probability,
  random,
  trials,
}: {
  probability: number;
  random: Random;
  trials: number;
}): number {
  return Array.from({ length: trials }).reduce<number>(
    (sum) => sum + (random() < probability ? 1 : 0),
    0,
  );
}
