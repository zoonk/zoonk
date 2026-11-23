import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type WritingResult } from "../writing-contract";

type Feedback = Extract<WritingResult, { kind: "levels" }>;
type PointRow = Extract<WritingResult, { kind: "points" }>["rows"][number];
const LEVEL_GAP = { complete: 0, missing: 3, partial: 2, strong: 1 };

export function writingRuleNextStep(kind: "limit" | "short" | "zero") {
  return { criterionId: "", example: null, kind, quote: null, text: "", title: null };
}

export function withSavedNextStep(grade: WritingResult): WritingResult {
  const { nextStep, ignoredFrom } = grade;

  if (nextStep?.kind) {
    return grade;
  }

  if (grade.kind === "points" && grade.zeroReason) {
    return { ...grade, nextStep: writingRuleNextStep("zero") };
  }

  const target = nextStep && grade.criteria.find(({ id }) => id === nextStep.criterionId);

  const row =
    nextStep && grade.kind === "points" && grade.rows.find(({ id }) => id === nextStep.criterionId);

  if (
    nextStep &&
    (row ? (row.range?.low ?? row.earned) < row.max : target && target.level !== "complete")
  ) {
    return { ...grade, nextStep: { ...nextStep, kind: "criterion" } };
  }

  return ignoredFrom === null ? grade : { ...grade, nextStep: writingRuleNextStep("limit") };
}

export function selectNextStep(
  { criteria, ignoredFrom, nextStep }: Pick<Feedback, "criteria" | "ignoredFrom" | "nextStep">,
  evidence: WritingEvidence,
  rows?: readonly PointRow[],
): Feedback["nextStep"] {
  const pointGaps = new Map(rows?.map((row) => [row.id, row.max - (row.range?.low ?? row.earned)]));

  const gap = ({ id, level }: Feedback["criteria"][number]) =>
    rows ? (pointGaps.get(id) ?? 0) : LEVEL_GAP[level];

  const remaining = criteria.filter((criterion) => gap(criterion) > 0);

  if (nextStep && remaining.some(({ id }) => id === nextStep.criterionId)) {
    return nextStep;
  }

  if (ignoredFrom !== null) {
    return writingRuleNextStep("limit");
  }

  const [criterion] = remaining.toSorted((first, second) => gap(second) - gap(first));

  if (!criterion) {
    return null;
  }

  return {
    criterionId: criterion.id,
    example: evidence.criteria.find(({ id }) => id === criterion.id)?.example ?? null,
    kind: "criterion",
    quote: criterion.quote,
    text: criterion.comment,
    title: null,
  };
}
