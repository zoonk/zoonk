import "server-only";
import { type Goal, type PlanChange, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { type PlanChangeView } from "../plan-view-contract";
import { parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { asksAboutAutomaticChange } from "./automatic-plan-change";
import { foldChangeAreas } from "./fold-part-areas";
import { latestLivingPlanChanges } from "./living-plan-change";
import { loadGraphPartAreas } from "./part-areas";
import { parsePlanChangePayload } from "./plan-change-payload";
import { canUndoChange, toPlanChangeView } from "./plan-change-view";
import { isDateReached } from "./plan-end";

export const RECENT_CHANGE_MS = 24 * 60 * 60 * 1000;

const MAX_PROPOSALS = 3;

export type TodayPlanChangeView = PlanChangeView;

async function findTodayChanges({
  dateReached,
  now,
  planId,
  planVersion,
}: {
  dateReached: boolean;
  now: Date;
  planId: string;
  planVersion: number;
}) {
  const [proposals, recent] = await Promise.all([
    prisma.planChange.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_PROPOSALS,
      where: { planId, status: "proposed" },
    }),
    prisma.planChange.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      where: {
        createdAt: { gte: new Date(now.getTime() - RECENT_CHANGE_MS) },
        planId,
        status: { in: ["applied", "undone"] },
      },
    }),
  ]);

  const changes = latestLivingPlanChanges(recent);

  const testOut = changes.find((change) => {
    const { lessonsSkipped, seenAt } = parsePlanChangePayload(change.payload);

    return (
      change.kind === "testedOut" &&
      Boolean(lessonsSkipped) &&
      seenAt === null &&
      canUndoChange({ change, planVersion })
    );
  });

  const automatic = changes.find(
    (change) =>
      change.status === "applied" &&
      asksAboutAutomaticChange({ change, dateReached }) &&
      parsePlanChangePayload(change.payload).seenAt === null,
  );

  return { automatic: automatic ?? null, proposals, testOut };
}

async function pickTodayChange({
  dateReached,
  now,
  planId,
  planVersion,
}: {
  dateReached: boolean;
  now: Date;
  planId: string;
  planVersion: number;
}): Promise<{ change: PlanChange; effect: PlanChangeView["effect"] } | null> {
  const { automatic, proposals, testOut } = await findTodayChanges({
    dateReached,
    now,
    planId,
    planVersion,
  });

  const proposal = proposals.find(
    (candidate) => parsePlanChangePayload(candidate.payload).effect !== null,
  );

  const change = testOut ?? proposal ?? automatic;
  return change && { change, effect: parsePlanChangePayload(change.payload).effect };
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

  const picked = plan
    ? await pickTodayChange({ dateReached, now, planId: plan.id, planVersion: plan.version })
    : null;

  if (!plan || !picked) {
    return null;
  }

  const { change, effect } = picked;

  const partAreas = await loadGraphPartAreas({
    examBlueprintId: goal.examBlueprintId,
    graph: parsePlanGraph(plan.graph),
  });

  const view = toPlanChangeView({ change, goal, planVersion: plan.version });

  return foldChangeAreas({ change: { ...view, effect }, partAreas });
}
