/**
 * Item response theory as ENEM scores it: a three-parameter logistic model where each question has
 * a discrimination, a difficulty and a chance of a lucky guess. A learner's ability is
 * the expected value of the posterior over a grid (EAP) with a standard normal prior, which stays
 * finite when every answer is right or wrong. Scores are estimates and are always shown as such.
 */
export type IrtItem = { difficulty: number; discrimination: number; guessing: number };

type IrtResponse = { correct: boolean; item: IrtItem };

export type AbilityEstimate = { se: number; theta: number };

/** The scaling constant that makes the logistic curve match the normal ogive. */
const SCALING = 1.7;
const GRID_MIN = -4;
const GRID_MAX = 4;
const GRID_STEP = 0.05;
const DEFAULT_DISCRIMINATION = 1;

/**
 * ENEM's scale: ability 0 is 500 and one standard deviation is 100 points, anchored on the 2009
 * graduating class. Scores outside 0 to 1000 are clamped for display.
 */
const ENEM_SCALE = { max: 1000, mean: 500, min: 0, sd: 100 } as const;

/** A 90% interval: wide enough to be honest about a short mock. */
export const Z_90 = 1.645;

/** Scores round to tens, so they never read as more precise than they are. */
export const SCORE_STEP = 10;

const GRID: readonly number[] = Array.from(
  { length: Math.round((GRID_MAX - GRID_MIN) / GRID_STEP) + 1 },
  (_, index) => GRID_MIN + index * GRID_STEP,
);

/** The chance of a right answer at an ability. */
function probabilityCorrect({ item, theta }: { item: IrtItem; theta: number }): number {
  return (
    item.guessing +
    (1 - item.guessing) / (1 + Math.exp(-SCALING * item.discrimination * (theta - item.difficulty)))
  );
}

function standardNormal(theta: number): number {
  return Math.exp(-(theta * theta) / 2);
}

function likelihood({ responses, theta }: { responses: readonly IrtResponse[]; theta: number }) {
  return responses.reduce((product, response) => {
    const chance = probabilityCorrect({ item: response.item, theta });
    return product * (response.correct ? chance : 1 - chance);
  }, 1);
}

/**
 * The learner's ability from their answers, with its standard error. Without answers it's the
 * prior: ability 0 with a standard error of 1.
 */
export function estimateAbility(responses: readonly IrtResponse[]): AbilityEstimate {
  const weights = GRID.map((theta) => likelihood({ responses, theta }) * standardNormal(theta));

  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (total === 0) {
    return { se: 1, theta: 0 };
  }

  const theta = GRID.reduce((sum, point, index) => sum + point * (weights[index] ?? 0), 0) / total;

  const variance =
    GRID.reduce((sum, point, index) => sum + (point - theta) ** 2 * (weights[index] ?? 0), 0) /
    total;

  return { se: Math.sqrt(variance), theta };
}

function clampScore(score: number): number {
  return Math.min(ENEM_SCALE.max, Math.max(ENEM_SCALE.min, score));
}

function roundScore(score: number): number {
  return Math.round(clampScore(score) / SCORE_STEP) * SCORE_STEP;
}

/** An ability on ENEM's scale, rounded to the nearest point. */
function toScaleScore(theta: number): number {
  return Math.round(clampScore(ENEM_SCALE.mean + ENEM_SCALE.sd * theta));
}

type ScaleScore = { high: number; low: number; score: number };

/** The score with its 90% range, rounded to tens so it never reads as more precise than it is. */
export function toScaleRange(estimate: AbilityEstimate): ScaleScore {
  const margin = Z_90 * estimate.se;

  return {
    high: roundScore(ENEM_SCALE.mean + ENEM_SCALE.sd * (estimate.theta + margin)),
    low: roundScore(ENEM_SCALE.mean + ENEM_SCALE.sd * (estimate.theta - margin)),
    score: toScaleScore(estimate.theta),
  };
}

/**
 * Pools several mocks' abilities, each weighed by its precision, into one estimate: more mocks
 * narrow the range, as a longer test would.
 */
export function poolAbilities(estimates: readonly AbilityEstimate[]): AbilityEstimate | null {
  const usable = estimates.filter((estimate) => estimate.se > 0);

  if (usable.length === 0) {
    return null;
  }

  const precision = usable.reduce((sum, estimate) => sum + 1 / estimate.se ** 2, 0);

  const theta =
    usable.reduce((sum, estimate) => sum + estimate.theta / estimate.se ** 2, 0) / precision;

  return { se: 1 / Math.sqrt(precision), theta };
}

/**
 * A bank item as the model reads it: its calibrated difficulty and discrimination when real
 * answers have set them, and the chance of guessing among its options.
 */
export function toIrtItem({
  difficulty,
  discrimination,
  options,
}: {
  difficulty: number | null;
  discrimination: number | null;
  /** Options to pick from: 5 for ENEM, 2 for a true or false statement. */
  options: number;
}): IrtItem {
  return {
    difficulty: difficulty ?? 0,
    discrimination: discrimination && discrimination > 0 ? discrimination : DEFAULT_DISCRIMINATION,
    guessing: options > 1 ? 1 / options : 0,
  };
}

/** Difficulty past these points reads as an easy or a hard question. */
const EASY_BELOW = -0.5;
const HARD_ABOVE = 0.5;

type IrtCoherence = {
  easyWrong: number;
  hardRight: number;
  /** Missing easy questions while getting hard ones right looks like guessing, and IRT weighs it. */
  isCoherent: boolean;
};

/**
 * ENEM's coherence: a right answer counts for more when the pattern makes sense. Easy questions
 * missed next to hard ones answered right lower the score, so those easy ones come first.
 */
export function getIrtCoherence(responses: readonly IrtResponse[]): IrtCoherence {
  const easyWrong = responses.filter(
    (response) => response.item.difficulty <= EASY_BELOW && !response.correct,
  ).length;

  const hardRight = responses.filter(
    (response) => response.item.difficulty >= HARD_ABOVE && response.correct,
  ).length;

  return { easyWrong, hardRight, isCoherent: easyWrong === 0 || hardRight === 0 };
}
