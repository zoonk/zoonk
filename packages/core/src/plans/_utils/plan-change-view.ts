import "server-only";
import { type Goal, type PlanChange, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getExamDocument } from "../../exams/exam-document";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getRequestInstant } from "../../learner/facts/request-instant";
import { OWN_LEVEL_SOURCE } from "../own-level-contract";
import { type PlanChangeView } from "../plan-view-contract";
import { addDays } from "../planner/plan-calendar";
import { isUndoableChange, parsePlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { isCurrentPlanPreview } from "./plan-preview-basis";

/** Changes stay on the plan for two weeks; proposals stay until the learner answers. */
const RECENT_CHANGE_DAYS = 14;
const MAX_CHANGES = 10;

/**
 * The app says changes from these sources itself, from their kind, operations and effect (a
 * rebalance after a session is "preparation"); other sources wrote a sentence for the learner. A
 * change read from the learner's words ("planEdit", the buddy's or the plan page's) is said from
 * what it does, never from the model's summary of what they asked, which can claim more than the
 * change does ("Sundays stay free" while the plan keeps its Sunday mocks).
 */
const LEARNER_FACING_SOURCES = new Set([
  "learner",
  OWN_LEVEL_SOURCE,
  "planEdit",
  "preparation",
  "system",
]);

/**
 * Edits and test-outs can be undone while the plan is exactly as they left it. Any later change
 * (another edit, missed days re-flowing) ends the undo, so an undo never reverts something else.
 */
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

/** The plan's goal as a change's view reads it: what its exam's documents are. */
export const changeGoalSelect = { kind: true, targetLanguage: true, timezone: true } as const;

export async function toPlanChangeView({
  change,
  goal,
  planVersion,
  now,
  timeZone,
}: {
  now?: Date;
  timeZone?: string | null;
  change: PlanChange;
  goal: Pick<Goal, "kind" | "targetLanguage" | "timezone">;
  planVersion: number;
}): Promise<PlanChangeView> {
  const payload = parsePlanChangePayload(change.payload);
  const zone = getAnswerTimeZone({ goal, timeZone });

  const canApply =
    change.status === "proposed" &&
    payload.effect !== null &&
    isCurrentPlanPreview({
      basis: payload.previewBasis,
      context: {
        plan: { version: planVersion },
        timeZone: zone,
        today: getDateInTimeZone({ date: now ?? (await getRequestInstant()), timeZone: zone }),
      },
    });

  return {
    behind: payload.behind,
    canApply,
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
    // A change without a sentence of its own (an exam notice's, say) is said by the app.
    reason: LEARNER_FACING_SOURCES.has(payload.source) || !change.reason ? null : change.reason,
    seen: payload.seenAt !== null,
    source: payload.source,
    status: change.status,
    todaySession: payload.todaySession,
  };
}

/** Proposals waiting for the learner's OK, then the changes of the last two weeks, newest first. */
export async function loadPlanChangeViews({
  context,
  goal,
  now,
  planId,
  planVersion,
}: {
  goal: Pick<Goal, "kind" | "targetLanguage" | "timezone">;
  now: Date;
  planId: string;
  planVersion: number;
  context: PlanContext;
}): Promise<PlanChangeView[]> {
  const changes = await prisma.planChange.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_CHANGES,
    where: {
      OR: [{ status: "proposed" }, { createdAt: { gte: addDays(now, -RECENT_CHANGE_DAYS) } }],
      planId,
    },
  });

  return Promise.all(
    changes
      .toSorted((a, b) => Number(b.status === "proposed") - Number(a.status === "proposed"))
      .map((change) =>
        toPlanChangeView({ change, goal, now, planVersion, timeZone: context.timeZone }),
      ),
  );
}
