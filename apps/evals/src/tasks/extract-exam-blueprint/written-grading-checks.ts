import { isComputableSheet } from "@zoonk/core/exams/essays/writing-sheet";

/** A written task as the notice states it; a field left out isn't checked, `null` must be unknown. */
export type WrittenTaskFact = {
  kind: "writtenTask";
  combination?: "sum" | "mean" | null;
  count?: number;
  criterionPoints?: number[];
  /** The sum of the criteria's maxima, for a sheet whose rows may be split several ways. */
  criteriaTotal?: number;
  /** The group whose every subject, and only those, the task is on; null when it names none. */
  drawsOn?: string | null;
  handwritten?: boolean | null;
  language?: { factor: number; method: "errorsPerLine" | "perError" | "other" } | null;
  /** How many caps on criteria the sheet holds at least. */
  limits?: number;
  lines?: number | null;
  /** How many counted elements the sheet's criteria hold together. */
  parts?: number;
  points?: number | null;
  rounding?: boolean;
  /** Each criterion's scale as its levels' points, lowest first; null for a criterion without one. */
  scales?: (number[] | null)[];
  /** Whether the sheet's own arithmetic works out the answer's points. */
  total?: boolean;
  zeroing?: boolean;
  /** Triggers the zero rules must cover, at least. */
  zeroKinds?: string[];
};

export type WrittenGrading = {
  combination?: { method: string; step: number | null } | null;
  criteria: {
    awards?: { count?: number | null; points: number | null; pointsHigh?: number | null }[];
    id: string;
    parts?: unknown[];
    points: number | null;
    weight?: number | null;
  }[];
  deductions?: unknown[];
  language: { factor: number | null; formula: string | null; method: string } | null;
  limits?: { criteria: string[]; max: number }[];
  rounding: {
    mode?: "nearest" | "down" | "up" | null;
    stage?: "criterion" | "total" | null;
    step?: number | null;
  } | null;
  totalSuppressed?: boolean;
  zeroing: { kinds?: string[] }[];
};

function hasLanguageRule(fact: WrittenTaskFact, grading: WrittenGrading | null | undefined) {
  const language = grading?.language ?? null;

  if (fact.language === undefined || fact.language === null) {
    return fact.language === undefined || language === null;
  }

  return language?.method === fact.language.method && language.factor === fact.language.factor;
}

type WritingSheet = Parameters<typeof isComputableSheet>[0]["grading"];

const NO_CITATION = { citation: { passage: "", sourceId: "" }, text: "" };

/** A reading's sheet in the stored shape, so both sides are judged by the same arithmetic. */
function toStoredSheet(grading: WrittenGrading): WritingSheet {
  const unheld = grading.combination?.method === "other" || (grading.deductions?.length ?? 0) > 0;

  return {
    ...grading,
    combination:
      grading.combination?.method === "sum" || grading.combination?.method === "mean"
        ? { ...grading.combination, method: grading.combination.method, ...NO_CITATION }
        : null,
    criteria: grading.criteria.map(({ awards, parts: _parts, weight, ...criterion }) => ({
      ...criterion,
      ...NO_CITATION,
      ...(awards?.length && {
        awards: awards.map(({ count: _count, points, pointsHigh }) => ({
          points,
          ...(typeof pointsHigh === "number" && { pointsHigh }),
          ...NO_CITATION,
        })),
      }),
      ...(typeof weight === "number" && { weight }),
    })),
    language: grading.language && {
      ...grading.language,
      method:
        grading.language.method === "perError" || grading.language.method === "errorsPerLine"
          ? grading.language.method
          : "other",
      ...NO_CITATION,
    },
    limits: grading.limits?.map((limit) => ({ ...limit, ...NO_CITATION })),
    rounding: grading.rounding && { ...grading.rounding, ...NO_CITATION },
    totalSuppressed: grading.totalSuppressed || unheld,
    zeroing: [],
  };
}

function hasTotal({ grading, points }: { grading: WrittenGrading; points: number | null }) {
  return isComputableSheet({ grading: toStoredSheet(grading), points });
}

function readScales(grading: WrittenGrading): (number[] | null)[] {
  return grading.criteria.map(({ awards }) =>
    awards?.length ? awards.map(({ points }) => points ?? -1) : null,
  );
}

function hasZeroKinds(fact: WrittenTaskFact, grading: WrittenGrading | null | undefined): boolean {
  const kinds = new Set(grading?.zeroing.flatMap((rule) => rule.kinds ?? []));
  return (fact.zeroKinds ?? []).every((kind) => kinds.has(kind));
}

function sumPoints(grading: WrittenGrading | null | undefined): number {
  return (grading?.criteria ?? []).reduce((sum, { points }) => sum + (points ?? 0), 0);
}

function hasSheetShape(fact: WrittenTaskFact, grading: WrittenGrading | null | undefined) {
  const combination = grading?.combination?.method ?? null;

  const counted = (grading?.criteria ?? []).reduce(
    (sum, { parts }) => sum + (parts?.length ?? 0),
    0,
  );

  return (
    (fact.combination === undefined || combination === fact.combination) &&
    (fact.criteriaTotal === undefined ||
      Math.abs(sumPoints(grading) - fact.criteriaTotal) < POINT_TOLERANCE) &&
    (fact.limits === undefined || (grading?.limits?.length ?? 0) >= fact.limits) &&
    (fact.parts === undefined || counted === fact.parts) &&
    (fact.scales === undefined ||
      JSON.stringify(grading ? readScales(grading) : []) === JSON.stringify(fact.scales)) &&
    hasZeroKinds(fact, grading)
  );
}

const POINT_TOLERANCE = 0.001;

/** Whether a task's read marking matches every grading field the fact states. */
export function hasGrading(
  fact: WrittenTaskFact,
  task: { grading?: WrittenGrading | null; points?: number | null },
): boolean {
  const grading = task.grading ?? null;
  const points = grading?.criteria.map((criterion) => criterion.points) ?? [];

  return (
    (fact.total === undefined ||
      (grading !== null && hasTotal({ grading, points: task.points ?? null })) === fact.total) &&
    (fact.criterionPoints === undefined ||
      JSON.stringify(points) === JSON.stringify(fact.criterionPoints)) &&
    hasSheetShape(fact, grading) &&
    hasLanguageRule(fact, grading) &&
    (fact.rounding === undefined || Boolean(grading?.rounding) === fact.rounding) &&
    (fact.zeroing === undefined || (grading?.zeroing.length ?? 0) > 0 === fact.zeroing)
  );
}
