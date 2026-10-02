const PERCENT = 100;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

type ModeSums = {
  activeDays: number;
  d1Eligible: number;
  d1Retained: number;
  d7Eligible: number;
  d7Retained: number;
  d30Eligible: number;
  d30Retained: number;
  learners: number;
  masteredSkills: number;
  paid: number;
  sessionsCompleted: number;
  sessionsStarted: number;
  spacedAnswers: number;
  spacedCorrect: number;
  studyDays: number;
  studySeconds: number;
  weeks: number;
};

export type ModeStratumRow = ModeSums & {
  ageBand: string;
  goalKind: string;
  locale: string;
  mode: string;
  signupWeek: Date;
};

type MatchedStratum = { focus: ModeStratumRow; fun: ModeStratumRow };

/** Every compared metric is `scale * numerator / denominator` of a stratum's sums. */
const MODE_METRICS = [
  { denominator: "d1Eligible", key: "d1Retention", numerator: "d1Retained", scale: PERCENT },
  { denominator: "d7Eligible", key: "d7Retention", numerator: "d7Retained", scale: PERCENT },
  { denominator: "d30Eligible", key: "d30Retention", numerator: "d30Retained", scale: PERCENT },
  { denominator: "weeks", key: "activeDaysPerWeek", numerator: "activeDays", scale: 1 },
  {
    denominator: "sessionsStarted",
    key: "sessionCompletion",
    numerator: "sessionsCompleted",
    scale: PERCENT,
  },
  {
    denominator: "studyDays",
    key: "dailyMinutes",
    numerator: "studySeconds",
    scale: 1 / SECONDS_PER_MINUTE,
  },
  {
    denominator: "spacedAnswers",
    key: "spacedAccuracy",
    numerator: "spacedCorrect",
    scale: PERCENT,
  },
  {
    denominator: "studySeconds",
    key: "masteredPerHour",
    numerator: "masteredSkills",
    scale: SECONDS_PER_HOUR,
  },
  { denominator: "learners", key: "plusConversion", numerator: "paid", scale: PERCENT },
] as const satisfies readonly {
  denominator: keyof ModeSums;
  key: string;
  numerator: keyof ModeSums;
  scale: number;
}[];

type ModeMetric = (typeof MODE_METRICS)[number];
export type ModeMetricKey = ModeMetric["key"];

export type ModeMetricComparison = {
  focus: number | null;
  fun: number | null;
  /** Fun learners in the strata where both modes have data for this metric. */
  funLearners: number;
  key: ModeMetricKey;
};

type ModeComparison = {
  focusLearners: number;
  funLearners: number;
  matchedStrata: number;
  metrics: ModeMetricComparison[];
  unmatchedLearners: number;
};

function getStratumKey(row: ModeStratumRow): string {
  return [row.goalKind, row.ageBand, row.locale, row.signupWeek.toISOString()].join("|");
}

function toMatchedStratum(rows: readonly ModeStratumRow[]): MatchedStratum[] {
  const focus = rows.find((row) => row.mode === "focus");
  const fun = rows.find((row) => row.mode === "fun");

  return focus && fun ? [{ focus, fun }] : [];
}

function getRatio({ metric, sums }: { metric: ModeMetric; sums: ModeSums }): number {
  return (metric.scale * sums[metric.numerator]) / sums[metric.denominator];
}

function getWeightedRatio({
  metric,
  side,
  strata,
  weight,
}: {
  metric: ModeMetric;
  side: keyof MatchedStratum;
  strata: readonly MatchedStratum[];
  weight: number;
}): number {
  const total = strata.reduce(
    (sum, stratum) => sum + stratum.fun.learners * getRatio({ metric, sums: stratum[side] }),
    0,
  );

  return total / weight;
}

/**
 * Only strata where both modes have a denominator can say anything about a metric, so each
 * metric uses its own subset and reports how many Fun learners it covers.
 */
function compareMetric({
  metric,
  strata,
}: {
  metric: ModeMetric;
  strata: readonly MatchedStratum[];
}): ModeMetricComparison {
  const usable = strata.filter(
    ({ focus, fun }) => focus[metric.denominator] > 0 && fun[metric.denominator] > 0,
  );

  const weight = usable.reduce((sum, stratum) => sum + stratum.fun.learners, 0);

  if (weight === 0) {
    return { focus: null, fun: null, funLearners: 0, key: metric.key };
  }

  return {
    focus: getWeightedRatio({ metric, side: "focus", strata: usable, weight }),
    fun: getWeightedRatio({ metric, side: "fun", strata: usable, weight }),
    funLearners: weight,
    key: metric.key,
  };
}

/**
 * Exact matching: only strata (goal kind, age band, locale, signup week) with learners in both
 * modes are compared, and each stratum is weighted by its Fun learners. Focus is reweighted to
 * look like the Fun group, so the difference estimates what Fun changed for the people who chose
 * it.
 */
export function compareMatchedModes(rows: readonly ModeStratumRow[]): ModeComparison {
  const strata = [...Map.groupBy(rows, getStratumKey).values()].flatMap((stratumRows) =>
    toMatchedStratum(stratumRows),
  );

  const focusLearners = strata.reduce((sum, stratum) => sum + stratum.focus.learners, 0);
  const funLearners = strata.reduce((sum, stratum) => sum + stratum.fun.learners, 0);
  const allLearners = rows.reduce((sum, row) => sum + row.learners, 0);

  return {
    focusLearners,
    funLearners,
    matchedStrata: strata.length,
    metrics: MODE_METRICS.map((metric) => compareMetric({ metric, strata })),
    unmatchedLearners: allLearners - focusLearners - funLearners,
  };
}
