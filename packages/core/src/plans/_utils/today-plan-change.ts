import "server-only";
import { type Goal, type PlanChange, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { PHASE_DATES_SOURCE } from "../plan-change-contract";
import { type PlanChangeView } from "../plan-view-contract";
import { showsPhaseDatesMove } from "../planner/phase-dates-move";
import { parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { isPlanReady } from "./apply-plan-change";
import { asksAboutAutomaticChange } from "./automatic-plan-change";
import { computeChange } from "./compute-change";
import { foldChangeAreas } from "./fold-part-areas";
import { applyChangeOperations, loadGraphPartAreas } from "./part-areas";
import { parsePlanChangePayload } from "./plan-change-payload";
import { changeGoalSelect, toPlanChangeView } from "./plan-change-view";
import { loadPlanContext } from "./plan-context";
import { isDateReached } from "./plan-end";

/** An automatic change is news for a day; after that it's simply how the plan is. */
export const RECENT_CHANGE_MS = 24 * 60 * 60 * 1000;

/**
 * The newest proposals Today weighs, one after another, for one that still changes something:
 * each preview plans the plan twice, and more than a couple waiting is rare.
 */
const MAX_PROPOSALS = 3;

/**
 * The plan change Today shows: a proposal waiting for an OK, or falling behind that puts the date
 * at risk, which waits for the learner's choice (see `asksAboutAutomaticChange`).
 */
export type TodayPlanChangeView = Omit<PlanChangeView, "id"> & {
  /** A computed mandatory read has no persisted ID until the learner's POST. */
  id: string | null;
};

/**
 * The newest proposals waiting for an OK, and the newest unseen automatic change of the last day
 * Today asks about, which it carries when no proposal is worth offering.
 */
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

/**
 * A proposal weighed against the plan as it is now, with the same dry run as accepting it: its
 * effect, null when the plan isn't ready or its operations can't apply, or `unchanged` when
 * applying it now would change nothing the learner can see. Pedro's Today offered to move his
 * phase dates, "a challenge falls on a day without room", with Apply and no diff: planned from
 * another day, the move no longer did anything (see `showsPhaseDatesMove`).
 */
async function previewProposal({
  change,
  goal,
  now,
  timeZone,
}: {
  change: PlanChange;
  goal: Goal;
  now: Date;
  timeZone?: string | null;
}): Promise<PlanChangeView["effect"] | "unchanged"> {
  const payload = parsePlanChangePayload(change.payload);
  const context = await loadPlanContext({ goal, now, timeZone });

  if (!context || !isPlanReady(context)) {
    return null;
  }

  const result = await applyChangeOperations({
    context,
    noticeGraph: payload.noticeGraph,
    operations: payload.operations,
  });

  if ("error" in result) {
    return null;
  }

  const { effect, unchanged } = await computeChange({
    context,
    operations: result.operations,
    reuseReadBuild: true,
    state: result.state,
  });

  const shows = payload.source !== PHASE_DATES_SOURCE || showsPhaseDatesMove(effect);

  return unchanged || !shows ? "unchanged" : effect;
}

/**
 * The change Today carries, with its effect: the newest proposal that still changes something (see
 * `previewProposal`), else the newest unseen automatic change of the last day.
 */
async function pickTodayChange({
  dateReached,
  goal,
  now,
  planId,
  skipPhaseDates,
  timeZone,
}: {
  dateReached: boolean;
  goal: Goal;
  now: Date;
  planId: string;
  skipPhaseDates: boolean;
  timeZone?: string | null;
}): Promise<{ change: PlanChange; effect: PlanChangeView["effect"] } | null> {
  const { automatic, proposals } = await findTodayChanges({
    dateReached,
    now,
    planId,
    skipPhaseDates,
  });

  for (const proposal of proposals) {
    // oxlint-disable-next-line no-await-in-loop -- the newest proposal still worth offering wins, so each waits for the one before it.
    const effect = await previewProposal({ change: proposal, goal, now, timeZone });

    if (effect !== "unchanged") {
      return { change: proposal, effect };
    }
  }

  return (
    automatic && { change: automatic, effect: parsePlanChangePayload(automatic.payload).effect }
  );
}

/**
 * The one plan change Today carries, so the learner can answer it where they are: OK or not now
 * for a proposal, and their choice when falling behind puts the date at risk. Null when there's
 * nothing to ask.
 */
export async function loadTodayPlanChange({
  goal,
  now,
  skipPhaseDates = false,
  timeZone,
}: {
  goal: Goal;
  now: Date;
  /** Leaves out a waiting proposal to move the phase dates, which the day's Open replaces. */
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
    ? await pickTodayChange({ dateReached, goal, now, planId: plan.id, skipPhaseDates, timeZone })
    : null;

  if (!plan || !picked) {
    return null;
  }

  const { change, effect } = picked;

  const partAreas = await loadGraphPartAreas({
    examBlueprintId: plan.goal.examBlueprintId,
    graph: parsePlanGraph(plan.graph),
  });

  const view = toPlanChangeView({ change, goal: plan.goal, planVersion: plan.version });

  return foldChangeAreas({ change: { ...view, effect }, partAreas });
}
