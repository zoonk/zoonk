import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { type NumericDomain } from "@zoonk/utils/plot-scale";
import { binomialCount, seededRandom, standardNormal } from "@zoonk/utils/seeded-random";
import { clamp } from "../_utils/snap-value";

export type Population = Extract<
  ActivityContentFor<"randomSimulation">["fields"],
  { mode: "sampling" }
>["population"];

const EXACT_LIMIT = 1000;
const MIDDLE_SHARE = 0.95;
const DOMAIN_REACH = 3.5;
const BIN_COUNT = 30;
const PERCENT = 100;
const WHOLE_FROM = 2;
const TENTHS = 10;

export function truthOf(population: Population): number {
  return population.kind === "proportion" ? population.proportion : population.mean;
}

function spreadOf(population: Population): number {
  return population.kind === "proportion"
    ? Math.sqrt(population.proportion * (1 - population.proportion))
    : population.sd;
}

export function simulateSamples({
  population,
  runs,
  seed,
  size,
}: {
  population: Population;
  runs: number;
  seed: number;
  size: number;
}): number[] {
  const random = seededRandom(seed);
  const error = spreadOf(population) / Math.sqrt(size);

  return Array.from({ length: runs }, () => {
    if (population.kind === "mean") {
      return population.mean + error * standardNormal(random);
    }

    if (size <= EXACT_LIMIT) {
      return binomialCount({ probability: population.proportion, random, trials: size }) / size;
    }

    const count = Math.round(size * (population.proportion + error * standardNormal(random)));
    return clamp(count, 0, size) / size;
  });
}

export function middleRange(results: readonly number[]): NumericDomain {
  const sorted = results.toSorted((first, second) => first - second);
  const tail = (1 - MIDDLE_SHARE) / 2;

  const at = (share: number) =>
    sorted[clamp(Math.round(share * (sorted.length - 1)), 0, sorted.length - 1)] ?? 0;

  return [at(tail), at(1 - tail)];
}

export function samplingDomain(population: Population, smallest: number): NumericDomain {
  const reach = (DOMAIN_REACH * spreadOf(population)) / Math.sqrt(smallest);
  const truth = truthOf(population);
  const domain: NumericDomain = [truth - reach, truth + reach];

  return population.kind === "proportion"
    ? [Math.max(domain[0], 0), Math.min(domain[1], 1)]
    : domain;
}

export type HistogramBin = { count: number; from: number; to: number };

export function histogram(results: readonly number[], [min, max]: NumericDomain): HistogramBin[] {
  const width = (max - min) / BIN_COUNT;

  const counts = results.reduce(
    (list, value) => {
      const index = clamp(Math.floor((value - min) / width), 0, BIN_COUNT - 1);
      list[index] = (list[index] ?? 0) + 1;
      return list;
    },
    Array.from<number>({ length: BIN_COUNT }).fill(0),
  );

  return counts.map((count, index) => ({
    count,
    from: min + index * width,
    to: min + (index + 1) * width,
  }));
}

export function valueDigits({ margin, population }: { margin: number; population: Population }) {
  const shown = population.kind === "proportion" ? margin * PERCENT : margin;

  if (shown >= WHOLE_FROM) {
    return 0;
  }

  return shown >= WHOLE_FROM / TENTHS ? 1 : 2;
}
