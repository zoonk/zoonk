import "server-only";
import { type Goal, type PlanChange, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { PHASE_DATES_SOURCE } from "../plan-change-contract";
import { type PlanChangeView } from "../plan-view-contract";
import { showsPhaseDatesMove } from "../planner/phase-dates-move";
import { parsePlanGraph, parsePlanSettings } from "../planner/plan-state";
import { isPlanReady } from "./apply-plan-change";
import { isAutomaticPlanChange } from "./automatic-plan-change";
import { computeChange } from "./compute-change";
import { getBehindChoices } from "./falling-behind";
import { foldChangeAreas } from "./fold-part-areas";
import { applyChangeOperations, loadGraphPartAreas } from "./part-areas";
import { parsePlanChangePayload } from "./plan-change-payload";
import { changeGoalSelect, toPlanChangeView } from "./plan-change-view";
import { loadPlanContext } from "./plan-context";
import { isDateReached } from "./plan-end";
import { computePlan } from "./replan";

/** An automatic change is news for a day; after that it's simply how the plan is. */
const RECENT_CHANGE_MS = 24 * 60 * 60 * 1000;

/**
 * The newest proposals Today weighs, one after another, for one that still changes something:
 * each preview plans the plan twice, and more than a couple waiting is rare.
 */
const MAX_PROPOSALS = 3;

/**
 * The plan change Today shows: a proposal waiting for an OK, or an automatic change of the last
 * day (a rebalance, falling behind, a test-out, a closer estimate that changed how many lessons
 * fit). A test-out names its chapter when every lesson it skipped is from one.
 */
export type TodayPlanChangeView = Omit<PlanChangeView, "id"> & {
  chapterTitle: string | null;
  /** A computed mandatory read has no persisted ID until the learner's POST. */
  id: string | null;
};

/** The chapter a test-out skipped lessons of, when they all come from the same one. */
async function loadSkippedChapterTitle({
  kind,
  planItemIds,
}: {
  kind: string;
  planItemIds: string[];
}): Promise<string | null> {
  if (kind !== "testedOut" || planItemIds.length === 0) {
    return null;
  }

  const items = await prisma.planItem.findMany({
    select: { chapter: { select: { title: true } }, chapterId: true },
    where: { id: { in: planItemIds } },
  });

  const [first] = items;
  const oneChapter = new Set(items.map((item) => item.chapterId)).size === 1;

  return oneChapter && first?.chapter ? first.chapter.title : null;
}

/**
 * The newest proposals waiting for an OK, and the newest unseen automatic change of the last day,
 * which Today carries when no proposal is worth offering.
 */
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
      isAutomaticPlanChange({ change, dateReached }) &&
      parsePlanChangePayload(change.payload).seenAt === null,
  );

  return { automatic: automatic ?? null, proposals };
}

type Behind = NonNullable<PlanChangeView["behind"]>;

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
  timeZone,
}: {
  dateReached: boolean;
  goal: Goal;
  now: Date;
  planId: string;
  timeZone?: string | null;
}): Promise<{ change: PlanChange; effect: PlanChangeView["effect"] } | null> {
  const { automatic, proposals } = await findTodayChanges({ dateReached, now, planId });

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
 * Falling behind's choices as the plan offers them now, as the Plan reads them: the plan can
 * move after the day's settle (lessons written, a session ended), and Rafaela's card said "about
 * 54%" beside her Plan's "about 55%". What the missed days did (covered before and after)
 * stays the settle's.
 */
async function loadCurrentBehind({
  behind,
  goal,
  now,
  timeZone,
}: {
  behind: Behind;
  goal: Goal;
  now: Date;
  timeZone?: string | null;
}): Promise<Behind> {
  const context = await loadPlanContext({ goal, now, timeZone });

  if (!context || context.phases.length === 0 || !isPlanReady(context)) {
    return behind;
  }

  const computed = await computePlan({
    context,
    mode: "automatic",
    now,
    pace: "saved",
    reuseReadBuild: true,
  });

  return { ...behind, ...getBehindChoices(computed) };
}

/**
 * The one plan change Today carries, so the learner can answer it where they are: OK or not now
 * for a proposal, and "Got it" (or an undo, while the plan is still as the change left it) for an
 * automatic change. Null when there's nothing to say.
 */
export async function loadTodayPlanChange({
  goal,
  now,
  timeZone,
}: {
  goal: Goal;
  now: Date;
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
    ? await pickTodayChange({ dateReached, goal, now, planId: plan.id, timeZone })
    : null;

  if (!plan || !picked) {
    return null;
  }

  const { change, effect } = picked;
  const { behind, planItemIds } = parsePlanChangePayload(change.payload);

  const [chapterTitle, partAreas, currentBehind] = await Promise.all([
    loadSkippedChapterTitle({ kind: change.kind, planItemIds }),
    loadGraphPartAreas({
      examBlueprintId: plan.goal.examBlueprintId,
      graph: parsePlanGraph(plan.graph),
    }),
    behind ? loadCurrentBehind({ behind, goal, now, timeZone }) : null,
  ]);

  const view = toPlanChangeView({ change, goal: plan.goal, planVersion: plan.version });

  return {
    ...foldChangeAreas({ change: { ...view, behind: currentBehind, effect }, partAreas }),
    chapterTitle,
  };
}
