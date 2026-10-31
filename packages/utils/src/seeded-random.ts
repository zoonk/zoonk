export type Random = () => number;

/** The Park-Miller "minimal standard" generator: plain arithmetic that stays exact in doubles. */
const MODULUS = 2_147_483_647;
const MULTIPLIER = 48_271;
const HASH_MULTIPLIER = 31;

export function seededRandom(seed: number): Random {
  const state = { value: (Math.abs(Math.floor(seed)) % (MODULUS - 1)) + 1 };

  return () => {
    state.value = (state.value * MULTIPLIER) % MODULUS;
    return (state.value - 1) / (MODULUS - 1);
  };
}

export function hashSeed(text: string): number {
  return Array.from({ length: text.length }, (_, index) => text.codePointAt(index) ?? 0).reduce(
    (hash, code) => (hash * HASH_MULTIPLIER + code) % MODULUS,
    0,
  );
}

export function seededShuffle<T>(items: readonly T[], seedText: string): T[] {
  const random = seededRandom(hashSeed(seedText));

  return items
    .map((item) => ({ item, key: random() }))
    .toSorted((first, second) => first.key - second.key)
    .map(({ item }) => item);
}

export function standardNormal(random: Random): number {
  const radius = Math.sqrt(-(2 * Math.log(1 - random())));
  return radius * Math.cos(2 * Math.PI * random());
}

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
