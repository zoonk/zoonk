import {
  type SpeakingCriterionFormat,
  type SpeakingFormat,
  type SpeakingScoreRow,
} from "./speaking-format";

type BandRange = { bandHigh: number; bandLow: number };

type SpeakingCriterionGrade = BandRange & { criterion: string };

/** One task's grade: its criteria's estimated bands, and how long the candidate spoke in it. */
export type SpeakingTaskGrade = {
  criteria: readonly SpeakingCriterionGrade[];
  spokenSeconds: number;
  task: string;
};

export type SpeakingSectionEstimate = {
  /** Every task has its grade, so the paper's points can be estimated. */
  complete: boolean;
  /** Each line of the mark sheet with its estimated band, once every task it needs is graded. */
  criteria: (BandRange & { criterion: string; task: string | null })[];
  /** The estimated points, low and high ends, on the paper's own total; null until complete. */
  high: number | null;
  low: number | null;
  total: number;
};

const HALF = 0.5;

/** A band that can fall between two of the row's points (Cambridge's half bands). */
function pointsAt({ band, row }: { band: number; row: SpeakingScoreRow }): number {
  const below = Math.floor(band);
  const low = row.points[below] ?? row.points.at(-1) ?? 0;
  const high = row.points[below + 1] ?? low;

  return low + (high - low) * (band - below);
}

function toStep({ criterion, value }: { criterion: SpeakingCriterionFormat; value: number }) {
  const step = criterion.halfBands ? HALF : 1;
  return Math.min(criterion.maxBand, Math.max(0, Math.round(value / step) * step));
}

function findGrade({ criterion, grade }: { criterion: string; grade: SpeakingTaskGrade }) {
  return grade.criteria.find((item) => item.criterion === criterion) ?? null;
}

/**
 * A criterion rated once for the whole paper, from every task that rated it: the mean of their
 * bands weighted by how long the candidate spoke in each (a task they barely spoke in says less),
 * rounded to a band the scale allows, as examiners may only give those.
 */
function combineTestCriterion({
  criterion,
  grades,
}: {
  criterion: SpeakingCriterionFormat;
  grades: readonly SpeakingTaskGrade[];
}): BandRange | null {
  const rated = grades
    .map((grade) => ({ found: findGrade({ criterion: criterion.key, grade }), grade }))
    .filter((item) => item.found !== null);

  if (rated.length === 0) {
    return null;
  }

  const weight = (item: (typeof rated)[number]) => Math.max(1, item.grade.spokenSeconds);
  const total = rated.reduce((sum, item) => sum + weight(item), 0);

  const mean = (side: keyof BandRange) =>
    rated.reduce((sum, item) => sum + weight(item) * (item.found?.[side] ?? 0), 0) / total;

  return {
    bandHigh: toStep({ criterion, value: mean("bandHigh") }),
    bandLow: toStep({ criterion, value: mean("bandLow") }),
  };
}

function rowBands({
  format,
  grades,
  row,
}: {
  format: SpeakingFormat;
  grades: readonly SpeakingTaskGrade[];
  row: SpeakingScoreRow;
}): BandRange | null {
  const criterion = format.criteria.find((item) => item.key === row.criterion);

  if (!criterion) {
    return null;
  }

  if (row.task === null) {
    return combineTestCriterion({ criterion, grades });
  }

  const grade = grades.find((item) => item.task === row.task);
  return grade ? findGrade({ criterion: row.criterion, grade }) : null;
}

/**
 * A whole speaking paper's estimate from its tasks' grades, the official way: each line of the mark
 * sheet takes its task's band (or, for a line rated once, the bands of every task), and its points
 * add up to the paper's total (DELE out of 25, Goethe B1 out of 100, B2 First out of 60). Until
 * every task is graded there are no points: one task alone would overclaim the paper.
 */
export function estimateSpeakingSection({
  format,
  grades,
}: {
  format: SpeakingFormat;
  grades: readonly SpeakingTaskGrade[];
}): SpeakingSectionEstimate {
  const lines = format.rows.map((row) => ({ bands: rowBands({ format, grades, row }), row }));
  const complete = lines.every((line) => line.bands !== null);

  const criteria = lines.flatMap(({ bands, row }) =>
    bands ? [{ ...bands, criterion: row.criterion, task: row.task }] : [],
  );

  const sum = (side: keyof BandRange) =>
    lines.reduce(
      (total, { bands, row }) => total + (bands ? pointsAt({ band: bands[side], row }) : 0),
      0,
    );

  return {
    complete,
    criteria,
    high: complete ? sum("bandHigh") : null,
    low: complete ? sum("bandLow") : null,
    total: format.total,
  };
}
