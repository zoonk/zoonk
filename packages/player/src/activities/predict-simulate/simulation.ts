import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { type Random, binomialCount, seededRandom } from "@zoonk/utils/seeded-random";

type RandomModel = ActivityContentFor<"predictSimulate">["fields"]["model"];

function rollDice(count: number, sides: number, random: Random): number {
  return Array.from({ length: count }, () => Math.floor(random() * sides) + 1).reduce(
    (sum, roll) => sum + roll,
    0,
  );
}

function hasSharedBirthday(people: number, days: number, random: Random): boolean {
  const birthdays = Array.from({ length: people }, () => Math.floor(random() * days));
  return new Set(birthdays).size < birthdays.length;
}

/** One run's outcome: successes, the dice total, or 1 when two people share a birthday. */
function simulateRun(model: RandomModel, random: Random): number {
  if (model.kind === "binomial") {
    return binomialCount({ probability: model.probability, random, trials: model.trials });
  }

  if (model.kind === "diceSum") {
    return rollDice(model.count, model.sides, random);
  }

  return hasSharedBirthday(model.people, model.days, random) ? 1 : 0;
}

export function isHit(model: RandomModel, outcome: number): boolean {
  if (model.kind === "sharedBirthday") {
    return outcome === 1;
  }

  const { comparison, value } = model.hit;

  if (comparison === "atLeast") {
    return outcome >= value;
  }

  return comparison === "atMost" ? outcome <= value : outcome === value;
}

export function runSimulation({
  model,
  runs,
  seed,
}: {
  model: RandomModel;
  runs: number;
  seed: number;
}): number[] {
  const random = seededRandom(seed);
  return Array.from({ length: runs }, () => simulateRun(model, random));
}

/** Counts per outcome between the smallest and largest seen, for the histogram. */
export function outcomeCounts(outcomes: readonly number[]): { count: number; outcome: number }[] {
  if (outcomes.length === 0) {
    return [];
  }

  const [low, high] = [Math.min(...outcomes), Math.max(...outcomes)];

  const counts = outcomes.reduce(
    (map, outcome) => map.set(outcome, (map.get(outcome) ?? 0) + 1),
    new Map<number, number>(),
  );

  return Array.from({ length: high - low + 1 }, (_, index) => ({
    count: counts.get(low + index) ?? 0,
    outcome: low + index,
  }));
}

/** The share of hits after each run, thinned to at most `points` points for drawing. */
export function runningShare(hits: readonly boolean[], points: number): { x: number; y: number }[] {
  const every = Math.max(Math.ceil(hits.length / points), 1);

  /* Pushing into the running totals keeps this linear; a copy per run would be quadratic. */
  const totals = hits.reduce<number[]>((sums, hit) => {
    sums.push((sums.at(-1) ?? 0) + (hit ? 1 : 0));
    return sums;
  }, []);

  return totals.flatMap((total, index) =>
    (index + 1) % every === 0 || index === hits.length - 1
      ? [{ x: index + 1, y: total / (index + 1) }]
      : [],
  );
}
