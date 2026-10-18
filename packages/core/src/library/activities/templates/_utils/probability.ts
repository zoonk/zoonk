/** Abramowitz and Stegun 7.1.26 coefficients: erf within 1.5e-7, plenty for a slider readout. */
const ERF_P = 0.3275911;
const ERF_A1 = 0.254829592;
const ERF_A2 = -0.284496736;
const ERF_A3 = 1.421413741;
const ERF_A4 = -1.453152027;
const ERF_A5 = 1.061405429;
const ERF_A = [ERF_A1, ERF_A2, ERF_A3, ERF_A4, ERF_A5];

type HitComparison = { comparison: "atLeast" | "atMost" | "exactly"; value: number };

function matchesHit(value: number, hit: HitComparison): boolean {
  switch (hit.comparison) {
    case "atLeast":
      return value >= hit.value;
    case "atMost":
      return value <= hit.value;
    case "exactly":
      return value === hit.value;
    default:
      return false;
  }
}

function range(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

function logChoose(total: number, chosen: number): number {
  return range(chosen).reduce(
    (sum, index) => sum + Math.log(total - chosen + index + 1) - Math.log(index + 1),
    0,
  );
}

/** The chance a binomial count (heads in `trials` flips) meets the hit. */
export function binomialHitProbability(params: {
  hit: HitComparison;
  probability: number;
  trials: number;
}): number {
  const { hit, probability, trials } = params;

  return range(trials + 1)
    .filter((count) => matchesHit(count, hit))
    .reduce(
      (sum, count) =>
        sum +
        Math.exp(
          logChoose(trials, count) +
            count * Math.log(probability) +
            (trials - count) * Math.log(1 - probability),
        ),
      0,
    );
}

function addDie(counts: readonly number[], sides: number): number[] {
  return range(counts.length + sides).map((total) =>
    range(sides).reduce((sum, face) => sum + (counts[total - face - 1] ?? 0), 0),
  );
}

/** The chance the sum of `count` fair dice meets the hit, from the exact sum distribution. */
export function diceSumHitProbability(params: {
  count: number;
  hit: HitComparison;
  sides: number;
}) {
  const counts = range(params.count).reduce<number[]>(
    (current) => addDie(current, params.sides),
    [1],
  );

  const outcomes = params.sides ** params.count;

  return counts.reduce(
    (sum, ways, total) => (matchesHit(total, params.hit) ? sum + ways / outcomes : sum),
    0,
  );
}

/** The birthday problem: the chance at least two of `people` share one of `days` birthdays. */
export function sharedBirthdayProbability(params: { days: number; people: number }): number {
  if (params.people > params.days) {
    return 1;
  }

  return (
    1 -
    range(params.people).reduce(
      (product, index) => product * ((params.days - index) / params.days),
      1,
    )
  );
}

function erf(value: number): number {
  const sign = Math.sign(value);
  const x = Math.abs(value);
  const t = 1 / (1 + ERF_P * x);
  const polynomial = ERF_A.reduceRight((sum, coefficient) => sum * t + coefficient, 0) * t;

  return sign * (1 - polynomial * Math.exp(-x * x));
}

export function normalCdf(params: { mean: number; sd: number; value: number }): number {
  return (1 + erf((params.value - params.mean) / (params.sd * Math.SQRT2))) / 2;
}
