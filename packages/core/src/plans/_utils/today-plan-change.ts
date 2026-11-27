import "server-only";
import { type Goal, sql } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { type PlanChangeView } from "../plan-view-contract";
import { parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { asksAboutAutomaticChange } from "./automatic-plan-change";
import { foldChangeAreas } from "./fold-part-areas";
import { latestLivingPlanChanges } from "./living-plan-change";
import { waitingPlanProposal } from "./notice-graph-proposal";
import { loadGraphPartAreas } from "./part-areas";
import { parsePlanChangePayload } from "./plan-change-payload";
import { canUndoChange, toPlanChangeView } from "./plan-change-view";
import { isDateReached } from "./plan-end";
import { readPlanChanges } from "./read-plan-changes";

export const RECENT_CHANGE_MS = 24 * 60 * 60 * 1000;

const MAX_PROPOSALS = 3;

export type TodayPlanChangeView = PlanChangeView;

async function findTodayChanges({
  dateReached,
  now,
  planId,
}: {
  dateReached: boolean;
  now: Date;
  planId: string;
}) {
  const [proposals, recent] = await Promise.all([
    readPlanChanges({ limit: MAX_PROPOSALS, planId, where: waitingPlanProposal }),
    readPlanChanges({
      planId,
      where: sql`
        change.status IN ('applied', 'undone')
        AND (change.created_at >= ${new Date(now.getTime() - RECENT_CHANGE_MS)} OR change.kind = 'noticeChanged')
      `,
    }),
  ]);

  const changes = latestLivingPlanChanges(recent).filter(
    (change) => parsePlanChangePayload(change.payload).seenAt === null,
  );

  const testOut = changes.find(
    (change) =>
      change.kind === "testedOut" &&
      Boolean(parsePlanChangePayload(change.payload).lessonsSkipped) &&
      canUndoChange({ change, planVersion: change.planVersion }),
  );

  const notice = changes.find(
    (change) => change.status === "applied" && change.kind === "noticeChanged",
  );

  const automatic = changes.find(
    (change) => change.status === "applied" && asksAboutAutomaticChange({ change, dateReached }),
  );

  return { automatic: automatic ?? null, notice, proposals, testOut };
}

async function pickTodayChange({
  dateReached,
  now,
  planId,
}: {
  dateReached: boolean;
  now: Date;
  planId: string;
}) {
  const { automatic, notice, proposals, testOut } = await findTodayChanges({
    dateReached,
    now,
    planId,
  });

  const proposal = proposals.find(
    (candidate) => parsePlanChangePayload(candidate.payload).effect !== null,
  );

  return testOut ?? notice ?? proposal ?? automatic;
}

export async function loadTodayPlanChange({
  goal,
  now,
  timeZone,
}: {
  goal: Goal;
  now: Date;
  timeZone?: string | null;
}): Promise<TodayPlanChangeView | null> {
  const plan = await readSavedPlan(goal.userId, goal.id);

  const dateReached =
    plan !== null &&
    isDateReached({
      studiesPastTarget: goal.kind === "exam" && parsePlanSettings(plan.settings).fullCourse,
      targetDate: goal.targetDate,
      today: getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal, timeZone }) }),
    });

  const change = plan ? await pickTodayChange({ dateReached, now, planId: plan.id }) : null;

  if (!plan || !change) {
    return null;
  }

  const partAreas = await loadGraphPartAreas({
    examBlueprintId: goal.examBlueprintId,
    graph: parsePlanGraph(plan.graph),
  });

  const view = toPlanChangeView({ change, goal, planVersion: change.planVersion });

  return foldChangeAreas({ change: view, partAreas });
}
