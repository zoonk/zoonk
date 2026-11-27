import { MAX_CEFR_SCORE } from "@zoonk/utils/cefr";

const GUESS_CHANCE = 0.25;
const SLOPE = 2.5;
const AT_LEVEL_OFFSET = 0.5;
const PRIOR_SPREAD = 1.5;
const HALF_STEP = 0.5;
const UPPER_TAIL = 0.95;

const GRID = Array.from(
  { length: MAX_CEFR_SCORE / HALF_STEP + 1 },
  (_, index) => index * HALF_STEP,
);

function getLikelihood({
  band,
  correct,
  theta,
}: {
  band: number;
  correct: boolean | null;
  theta: number;
}) {
  const knows = 1 / (1 + Math.exp(-SLOPE * (theta - band + AT_LEVEL_OFFSET)));

  if (correct === null) {
    return 1 - knows;
  }

  const right = GUESS_CHANCE + (1 - GUESS_CHANCE) * knows;
  return correct ? right : 1 - right;
}

export type ScoredAnswer = { band: number; correct: boolean | null };

export function getPosterior({ answers, start }: { answers: ScoredAnswer[]; start: number }) {
  const weights = GRID.map((theta) => {
    const prior = Math.exp(-((theta - start) ** 2) / (2 * PRIOR_SPREAD ** 2));

    return answers.reduce((weight, answer) => weight * getLikelihood({ ...answer, theta }), prior);
  });

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return GRID.map((theta, index) => ({ probability: (weights[index] ?? 0) / total, theta }));
}

export type Posterior = ReturnType<typeof getPosterior>;

export function getMean(posterior: Posterior) {
  return posterior.reduce((sum, { probability, theta }) => sum + theta * probability, 0);
}

export function getLowerBound(posterior: Posterior) {
  const quantile = posterior.reduceRight(
    ({ bound, tail }, { probability, theta }) => ({
      bound: tail < UPPER_TAIL ? theta : bound,
      tail: tail + probability,
    }),
    { bound: 0, tail: 0 },
  );

  return quantile.bound;
}

export function getUpperBound(posterior: Posterior) {
  const quantile = posterior.reduce(
    ({ bound, tail }, { probability, theta }) => ({
      bound: tail < UPPER_TAIL ? theta : bound,
      tail: tail + probability,
    }),
    { bound: MAX_CEFR_SCORE, tail: 0 },
  );

  return quantile.bound;
}
