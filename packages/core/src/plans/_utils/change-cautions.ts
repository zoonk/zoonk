import "server-only";
import { type Goal } from "@zoonk/db";
import { loadExamNoticeFacts } from "../../exams/_utils/exam-notice-facts";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { type PlanOperation } from "../plan-contract";
import { addDays, fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type PlanEffect } from "../planner/plan-effect";

export type PlanChangeCaution =
  | { area: string; kind: "leavesOutExamSubject"; questions: number }
  | { endDate: string; kind: "endsBeforeDate"; targetDate: string };

type CautionGoal = Pick<
  Goal,
  "createdAt" | "details" | "examBlueprintId" | "id" | "kind" | "targetDate" | "timezone"
>;

const EARLY_END_DAYS = 7;

async function findLeftOutSubjects({
  goal,
  operations,
}: {
  goal: CautionGoal;
  operations: readonly PlanOperation[];
}): Promise<PlanChangeCaution[]> {
  const areas = operations.flatMap((operation) =>
    operation.kind === "skipAreas" ? operation.areas : [],
  );

  if (areas.length === 0) {
    return [];
  }

  const facts = await loadExamNoticeFacts(goal);
  const subjects = facts?.subjects ?? [];

  const matches = matchAreasToSubjects({ areas, subjects });

  return areas.flatMap((area) => {
    const index = matches.get(area);
    const questions = index === undefined ? null : subjects[index]?.questions;

    return questions ? [{ area, kind: "leavesOutExamSubject" as const, questions }] : [];
  });
}

function findEarlyEnd({
  effect,
  targetDate,
}: {
  effect: PlanEffect | null;
  targetDate: string | null;
}): PlanChangeCaution[] {
  const endDate = effect?.endDateAfter;

  if (!targetDate || !endDate || (effect.endDateBefore && endDate >= effect.endDateBefore)) {
    return [];
  }

  const latestEarlyEnd = toIsoDate(addDays(fromIsoDate(targetDate), -EARLY_END_DAYS));

  return endDate < latestEarlyEnd ? [{ endDate, kind: "endsBeforeDate", targetDate }] : [];
}

export async function findChangeCautions({
  effect,
  goal,
  operations,
}: {
  effect: PlanEffect | null;
  goal: CautionGoal;
  operations: readonly PlanOperation[];
}): Promise<PlanChangeCaution[]> {
  const dateChange = operations.findLast((operation) => operation.kind === "setTargetDate");

  const targetDate =
    dateChange?.kind === "setTargetDate"
      ? dateChange.targetDate
      : goal.targetDate && toIsoDate(goal.targetDate);

  const leftOut = await findLeftOutSubjects({ goal, operations });

  return [...leftOut, ...findEarlyEnd({ effect, targetDate })];
}
