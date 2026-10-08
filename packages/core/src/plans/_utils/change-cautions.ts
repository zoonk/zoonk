import "server-only";
import { type Goal } from "@zoonk/db";
import { loadExamNoticeFacts } from "../../exams/_utils/exam-notice-facts";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { type PlanOperation } from "../plan-contract";
import { addDays, fromIsoDate, toIsoDate } from "../planner/plan-calendar";
import { type PlanEffect } from "../planner/plan-effect";

/**
 * What a proposed change costs the learner that they should hear before they apply it: an exam
 * subject with questions left out of the plan, or a plan that would end weeks before its date
 * with nothing planned in between.
 */
export type PlanChangeCaution =
  | { area: string; kind: "leavesOutExamSubject"; questions: number }
  | { endDate: string; kind: "endsBeforeDate"; targetDate: string };

type CautionGoal = Pick<
  Goal,
  "createdAt" | "details" | "examBlueprintId" | "kind" | "targetDate" | "timezone"
>;

/** A plan that ends this many days before its date or less still uses its time. */
const EARLY_END_DAYS = 7;

/** The exam subjects with questions that the change leaves out, by the notice's question counts. */
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

  const matches = matchAreasToSubjects({
    areas,
    subjects: subjects.map((subject) => subject.name),
  });

  return areas.flatMap((area) => {
    const index = matches.get(area);
    const questions = index === undefined ? null : subjects[index]?.questions;

    return questions ? [{ area, kind: "leavesOutExamSubject" as const, questions }] : [];
  });
}

/** The plan would end more than a week before its date, earlier than it does now. */
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

/**
 * What a change proposed to the learner costs them, for whoever offers it to say before they
 * apply it: never left for the learner to find out on their plan.
 */
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
