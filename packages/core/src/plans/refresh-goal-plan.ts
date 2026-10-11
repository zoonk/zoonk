import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@zoonk/db";
import { isPlanReady } from "./_utils/apply-plan-change";
import {
  loadCarryOver,
  loadTodaySettledItemIds,
  wasLastDayStudied,
} from "./_utils/carried-lessons";
import { getCoverageChange } from "./_utils/coverage-change";
import { getFallingBehind } from "./_utils/falling-behind";
import {
  updatePhaseDatesProposal,
  withdrawUnneededPhaseDatesProposal,
} from "./_utils/phase-dates-proposal";
import { toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext, loadPlanContext } from "./_utils/plan-context";
import { isPlanUnchanged } from "./_utils/plan-unchanged";
import {
  type ComputedPlan,
  type PlanChangeRecord,
  type PlanTagRevalidation,
  commitPlan,
  computePlan,
  withPlanRetry,
} from "./_utils/replan";
import { withSeenTopics } from "./_utils/seen-effect";
import { computeSettledPlan } from "./_utils/settled-plan";
import { savePlanInputsKey } from "./_utils/write-plan";
import { type CarryOver, carriesGiven } from "./planner/carry-over";
import { listPhaseEndMoves } from "./planner/phase-dates-move";
import { addDays } from "./planner/plan-calendar";
import { isMorePrecise } from "./planner/plan-pace";

type PlanRefreshResult = { status: "notFound" | "notReady" | "paused" | "refreshed" | "unchanged" };

/** Plain notes for logs and admin; the apps say these changes from their kind and numbers. */
const LEFT_WORK_NOTE = "Lessons earlier days left come first; the rest of the plan moved forward.";
const MORE_PRECISE_NOTE = "The estimate now uses a closer pace.";

const LEARN_KINDS = new Set(["chapter", "lesson"]);

/**
 * The work earlier days left that today doesn't start with yet: lessons due before today, and
 * lessons the last study day gave the learner that the plan has after today. Once today settled
 * them, those that didn't fit today come first tomorrow: they aren't left again (`settledToday`).
 */
function findLeftWork({
  carryOver,
  context,
  settledToday,
}: {
  carryOver: CarryOver;
  context: PlanContext;
  settledToday: boolean;
}) {
  const given = new Set(settledToday ? [] : carryOver.lessonIds);
  const carries = carriesGiven(context.items);
  const { today } = context;

  return context.items.filter(
    (item) =>
      item.status === "todo" &&
      LEARN_KINDS.has(item.kind) &&
      item.scheduledFor !== null &&
      (item.scheduledFor < today ||
        (item.lessonId !== null &&
          given.has(item.lessonId) &&
          item.scheduledFor > today &&
          carries(item))),
  );
}

/** The earlier days that left work: the days it was due, or the last study day for the rest. */
function countLeftDays({ context, left }: { context: PlanContext; left: PlanContext["items"] }) {
  const overdue = left.filter((item) => item.scheduledFor && item.scheduledFor < context.today);
  const days = new Set(overdue.map((item) => item.scheduledFor?.getTime())).size;

  return Math.max(1, days);
}

/**
 * The planner dated the plan's phases: a plan written but never laid out (no phase has a start
 * date; the learner saw only "Building your plan") has nothing a day build could move.
 */
function isLaidOut(context: PlanContext): boolean {
  return context.phases.some((phase) => phase.startDate !== null);
}

/**
 * A new day settles what earlier days left: it comes first, in the order it was planned, and the
 * rest of the plan moves forward from today at the pace the learner's progress sets. Said once on
 * the plan, and on Today when falling behind now covers less of the goal by its date. The phase
 * end dates the learner saw stay, as through any change the learner didn't make, and Today asks
 * before moving them when keeping them leaves lessons out by the goal's date: Carla's first phase
 * moved from Oct 29 to 30 overnight because she left lessons of a day she studied. After a day
 * they missed, an end whose challenge would come before the lessons it tests moves (see
 * `computeSettledPlan`), and the change names each end that moved.
 */
async function settleLeftWork({
  context,
  left,
  pace,
  revalidation,
}: {
  context: PlanContext;
  left: PlanContext["items"];
  pace: "sampled" | "saved";
  revalidation: PlanTagRevalidation;
}): Promise<PlanRefreshResult> {
  const missed = !(await wasLastDayStudied(context));
  const computed = await computeSettledPlan({ context, missed, pace });
  const phaseEnds = listPhaseEndMoves({ after: computed.built.phases, shown: context.phases });

  await commitPlan({
    change: {
      kind: "missedDays",
      payload: toPlanChangePayload({
        behind: getFallingBehind({ computed, context }),
        carriedItemIds: left.map((item) => item.id),
        days: countLeftDays({ context, left }),
        effect: {
          ...withSeenTopics({ computed, shown: context.items }),
          ...(phaseEnds.length > 0 && { phaseEnds }),
        },
        source: "system",
      }),
      reason: LEFT_WORK_NOTE,
      status: "applied",
    },
    computed,
    context,
    revalidation,
  });

  await updatePhaseDatesProposal({ computed, context, mode: "forced", pace, revalidation });

  return { status: "refreshed" };
}

function getPaceChange({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): PlanChangeRecord | null {
  if (!isMorePrecise({ next: computed.pace, previous: context.state.settings.pace })) {
    return null;
  }

  return {
    kind: "estimateUpdated",
    payload: toPlanChangePayload({ effect: computed.effect, source: "system" }),
    reason: MORE_PRECISE_NOTE,
    status: "applied",
  };
}

/**
 * What a refresh plans, and from what (`planned`): an automatic run, except after a session whose
 * new pace lays this week's kept work past the week (`spill`). Then the rest is laid out from
 * tomorrow, as tomorrow's settling would lay it: today's unfinished work first, the phase end
 * dates kept, and nothing more today, whose session just ended. Kept as it was, a Câmara plan
 * whose pace slowed spilled three days into the next week, and the next morning's settling planned
 * the week again: 29 lessons of 10 skills left the plan and 5 came in.
 */
async function computeRefreshedPlan({
  context,
  pace,
}: {
  context: PlanContext;
  pace: "sampled" | "saved";
}): Promise<{ computed: ComputedPlan; mode: "automatic" | "forced"; planned: PlanContext }> {
  const automatic = await computePlan({ context, mode: "automatic", pace });
  const newPace = !isDeepStrictEqual(automatic.pace, context.state.settings.pace);

  if (pace === "saved" || !newPace || automatic.built.spill <= 0) {
    return { computed: automatic, mode: "automatic", planned: context };
  }

  const planned = { ...context, today: addDays(context.today, 1) };

  const computed = await computePlan({
    context: planned,
    keepPhaseDates: true,
    mode: "forced",
    pace,
  });

  return { computed, mode: "forced", planned };
}

/**
 * Keeps an active goal's plan current, and only changes it when something did: a new day settles
 * what earlier days left (see `settleLeftWork`); lessons the Library outlined since take their
 * skill's place, this week's in place of their stand-ins; and after a session (`sampled`), the pace
 * the learner's progress sets moves what comes after this week (a closer pace is announced once),
 * or from tomorrow when this week no longer holds its work (see `computeRefreshedPlan`).
 * A refresh that changes which topics the plan teaches records it for Today to say (see
 * `getCoverageChange`).
 * All of them keep the phase end dates the learner saw, and Today asks before moving them when
 * keeping them leaves lessons out by the goal's date (see `updatePhaseDatesProposal`); only a
 * change the learner makes moves them.
 * Opening a screen reads the saved pace (`saved`), so a day that only begins changes nothing. Writes
 * nothing when the run plans from what the saved plan was planned from (see `getPlanInputsKey`):
 * laid out another way than the run that saved it, an OAB plan a focus re-planned that morning
 * moved 600 items with nothing new. Writes nothing either when the work and its time stayed the
 * same, wherever a new run would lay it. Does nothing for paused goals or plans not built yet.
 */
export async function refreshGoalPlan({
  goalId,
  pace = "saved",
  revalidation = "now",
  settleOnly = false,
}: {
  goalId: string;
  /** `sampled` after the learner's progress (a session ended); `saved` otherwise. */
  pace?: "sampled" | "saved";
  /** Building a day while a page renders can't clear caches, and has none to clear. */
  revalidation?: PlanTagRevalidation;
  /**
   * Building a day only settles what earlier days left: opening the app with nothing new changes
   * nothing. Planned again from its own output, a plan isn't always laid out the same way, and a
   * career plan's first open of Today added lessons and moved its last weeks. A plan never laid
   * out is still laid out (see `isLaidOut`).
   */
  settleOnly?: boolean;
}): Promise<PlanRefreshResult> {
  return withPlanRetry(async () => {
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });

    if (!goal) {
      return { status: "notFound" };
    }

    if (goal.status !== "active") {
      return { status: "paused" };
    }

    const context = await loadPlanContext({ goal });

    if (!context || !isPlanReady(context)) {
      return { status: context ? "notReady" : "notFound" };
    }

    const [carryOver, settledIds] = await Promise.all([
      loadCarryOver({ goalId, today: context.today }),
      loadTodaySettledItemIds(context),
    ]);

    const left = findLeftWork({ carryOver, context, settledToday: settledIds !== null });

    if (left.length > 0) {
      return settleLeftWork({ context, left, pace, revalidation });
    }

    if (settleOnly && isLaidOut(context)) {
      return { status: "unchanged" };
    }

    const { computed, mode, planned } = await computeRefreshedPlan({ context, pace });

    if (computed.inputsKey === context.plan.inputsKey) {
      await withdrawUnneededPhaseDatesProposal({ computed, context, revalidation });
      return { status: "unchanged" };
    }

    const change = getCoverageChange({ computed, context }) ?? getPaceChange({ computed, context });
    const unchanged = !change && isPlanUnchanged({ computed, context });

    await (unchanged
      ? savePlanInputsKey({ context, graph: computed.state.graph, inputsKey: computed.inputsKey })
      : commitPlan({ change, computed, context, revalidation }));

    // Moving the dates is planned from the day the run planned from, to compare: from today, whose
    // time was still open, a career plan's lessons fit before their challenges, and Today asked
    // nothing while the plan held them after (career 2131).
    await updatePhaseDatesProposal({ computed, context: planned, mode, pace, revalidation });

    return { status: unchanged ? "unchanged" : "refreshed" };
  });
}
