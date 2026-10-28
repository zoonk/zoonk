import "server-only";
import { type Goal, type PlanChange, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { PHASE_DATES_SOURCE } from "../plan-change-contract";
import { type PlanChangeView } from "../plan-view-contract";
import { parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { asksAboutAutomaticChange } from "./automatic-plan-change";
import { foldChangeAreas } from "./fold-part-areas";
import { loadGraphPartAreas } from "./part-areas";
import { parsePlanChangePayload } from "./plan-change-payload";
import { changeGoalSelect, toPlanChangeView } from "./plan-change-view";
import { isDateReached } from "./plan-end";

export const RECENT_CHANGE_MS = 24 * 60 * 60 * 1000;

const MAX_PROPOSALS = 3;

export type TodayPlanChangeView = PlanChangeView;

async function findTodayChanges({
  dateReached,
  now,
  planId,
  skipPhaseDates,
}: {
  dateReached: boolean;
  now: Date;
  planId: string;
  skipPhaseDates: boolean;
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
        status: "applied",
      },
    }),
  ]);

  const automatic = recent.find(
    (change) =>
      asksAboutAutomaticChange({ change, dateReached }) &&
      parsePlanChangePayload(change.payload).seenAt === null,
  );

  const offered = skipPhaseDates
    ? proposals.filter(
        (proposal) => parsePlanChangePayload(proposal.payload).source !== PHASE_DATES_SOURCE,
      )
    : proposals;

  return { automatic: automatic ?? null, proposals: offered };
}

async function pickTodayChange({
  dateReached,
  now,
  planId,
  skipPhaseDates,
}: {
  dateReached: boolean;
  now: Date;
  planId: string;
  skipPhaseDates: boolean;
}): Promise<{ change: PlanChange; effect: PlanChangeView["effect"] } | null> {
  const { automatic, proposals } = await findTodayChanges({
    dateReached,
    now,
    planId,
    skipPhaseDates,
  });

  const proposal = proposals.find(
    (candidate) => parsePlanChangePayload(candidate.payload).effect !== null,
  );

  if (proposal) {
    return { change: proposal, effect: parsePlanChangePayload(proposal.payload).effect };
  }

  return (
    automatic && { change: automatic, effect: parsePlanChangePayload(automatic.payload).effect }
  );
}

export async function loadTodayPlanChange({
  goal,
  now,
  skipPhaseDates = false,
  timeZone,
}: {
  goal: Goal;
  now: Date;
  skipPhaseDates?: boolean;
  timeZone?: string | null;
}): Promise<TodayPlanChangeView | null> {
  const goalId = goal.id;

  const plan = await prisma.plan.findUnique({
    select: {
      goal: { select: { ...changeGoalSelect, examBlueprintId: true } },
      graph: true,
      id: true,
      settings: true,
      version: true,
    },
    where: { goalId },
  });

  const dateReached =
    plan !== null &&
    isDateReached({
      studiesPastTarget: goal.kind === "exam" && parsePlanSettings(plan.settings).fullCourse,
      targetDate: goal.targetDate,
      today: getDateInTimeZone({ date: now, timeZone: getAnswerTimeZone({ goal, timeZone }) }),
    });

  const picked = plan
    ? await pickTodayChange({ dateReached, now, planId: plan.id, skipPhaseDates })
    : null;

  if (!plan || !picked) {
    return null;
  }

  const { change, effect } = picked;

  const [partAreas, view] = await Promise.all([
    loadGraphPartAreas({
      examBlueprintId: plan.goal.examBlueprintId,
      graph: parsePlanGraph(plan.graph),
    }),
    toPlanChangeView({ change, goal: plan.goal, now, planVersion: plan.version, timeZone }),
  ]);

  return foldChangeAreas({ change: { ...view, effect }, partAreas });
}
