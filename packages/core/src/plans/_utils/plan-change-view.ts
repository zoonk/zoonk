import "server-only";
import { type Goal, type PlanChange, prisma } from "@zoonk/db";
import { getExamDocument } from "../../exams/exam-document";
import { OWN_LEVEL_SOURCE } from "../own-level-contract";
import { type PlanChangeView } from "../plan-view-contract";
import { addDays } from "../planner/plan-calendar";
import { isUndoableChange, parsePlanChangePayload } from "./plan-change-payload";
import { getPlanChangeQuote } from "./plan-change-quote";

const RECENT_CHANGE_DAYS = 14;
const MAX_CHANGES = 10;

/**
 * The app words changes from these sources itself: a model's summary of the learner's words can
 * claim more than the change does.
 */
const LEARNER_FACING_SOURCES = new Set([
  "learner",
  "mock",
  OWN_LEVEL_SOURCE,
  "planEdit",
  "preparation",
  "system",
]);

export function canUndoChange({
  change,
  planVersion,
}: {
  change: Pick<PlanChange, "kind" | "payload" | "status">;
  planVersion: number;
}): boolean {
  return (
    isUndoableChange(change) && parsePlanChangePayload(change.payload).versionAfter === planVersion
  );
}

export const changeGoalSelect = { kind: true, targetLanguage: true } as const;

export function toPlanChangeView({
  change,
  goal,
  planVersion,
}: {
  change: PlanChange;
  goal: Pick<Goal, "kind" | "targetLanguage">;
  planVersion: number;
}): PlanChangeView {
  const payload = parsePlanChangePayload(change.payload);

  return {
    behind: payload.behind,
    // Accepting works the change out again and asks again when its numbers moved.
    canApply: change.status === "proposed" && payload.effect !== null,
    canUndo: canUndoChange({ change, planVersion }),
    createdAt: change.createdAt.toISOString(),
    days: payload.days,
    effect: payload.effect,
    examDocument: getExamDocument(goal),
    id: change.id,
    kind: change.kind,
    lessonsSkipped: payload.lessonsSkipped ?? 0,
    officialDate: payload.officialDate,
    operations: payload.operations,
    quote: getPlanChangeQuote(payload.effect),
    reason: LEARNER_FACING_SOURCES.has(payload.source) || !change.reason ? null : change.reason,
    seen: payload.seenAt !== null,
    source: payload.source,
    status: change.status,
    todaySession: payload.todaySession,
  };
}

export async function loadPlanChangeViews({
  goal,
  now,
  planId,
  planVersion,
}: {
  goal: Pick<Goal, "kind" | "targetLanguage">;
  now: Date;
  planId: string;
  planVersion: number;
}): Promise<PlanChangeView[]> {
  const changes = await prisma.planChange.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_CHANGES,
    where: {
      OR: [{ status: "proposed" }, { createdAt: { gte: addDays(now, -RECENT_CHANGE_DAYS) } }],
      planId,
    },
  });

  return changes
    .toSorted((a, b) => Number(b.status === "proposed") - Number(a.status === "proposed"))
    .map((change) => toPlanChangeView({ change, goal, planVersion }));
}
