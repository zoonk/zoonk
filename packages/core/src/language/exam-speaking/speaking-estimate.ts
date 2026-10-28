import {
  type SpeakingCriterionFormat,
  type SpeakingFormat,
  type SpeakingScoreRow,
} from "./speaking-format";

type BandRange = { bandHigh: number; bandLow: number };

type SpeakingCriterionGrade = BandRange & { criterion: string };

export type SpeakingTaskGrade = {
  criteria: readonly SpeakingCriterionGrade[];
  spokenSeconds: number;
  task: string;
};

export type SpeakingSectionEstimate = {
  complete: boolean;
  criteria: (BandRange & { criterion: string; task: string | null })[];
  high: number | null;
  low: number | null;
  total: number;
};

const HALF = 0.5;

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
