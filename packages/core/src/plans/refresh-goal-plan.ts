import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@zoonk/db";
import { isPlanReady } from "./_utils/apply-plan-change";
import { wasLastDayStudied } from "./_utils/carried-lessons";
import { getEstimateChange } from "./_utils/estimate-change";
import { loadLeftWork } from "./_utils/left-work";
import {
  updatePhaseDatesProposal,
  withdrawUnneededPhaseDatesProposal,
} from "./_utils/phase-dates-proposal";
import { type PlanContext, loadPlanContext } from "./_utils/plan-context";
import { addsLessonsAfterLessonsDone, isPlanLaidOut } from "./_utils/plan-refresh-admission";
import { isPlanUnchanged } from "./_utils/plan-unchanged";
import {
  type ComputedPlan,
  type PlanTagRevalidation,
  commitPlan,
  computePlan,
} from "./_utils/replan";
import { getSettledPlanChange } from "./_utils/settled-change";
import { computeSettledPlan } from "./_utils/settled-plan";
import { savePlanInputsKey } from "./_utils/write-plan";
import { withPlanRetry } from "./plan-conflict";
import { addDays } from "./planner/plan-calendar";

type PlanRefreshResult = { status: "notFound" | "notReady" | "paused" | "refreshed" | "unchanged" };

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

  await commitPlan({
    change: getSettledPlanChange({ computed, context, left }),
    computed,
    context,
    revalidation,
  });

  await updatePhaseDatesProposal({
    computed,
    context,
    mode: "forced",
    pace,
    revalidation,
    writeVersion: {
      ...context.plan,
      inputVersion: context.plan.inputVersion + 1,
      version: context.plan.version + 1,
    },
  });

  return { status: "refreshed" };
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
 * the learner's progress sets moves what comes after this week, or from tomorrow
 * when this week no longer holds its work (see `computeRefreshedPlan`).
 * A refresh says how many more or fewer lessons fit when the net count the learner saw changes
 * past the shared threshold (see `getEstimateChange`), including closer pace data, drift within
 * its source, and written lessons replacing estimates. Its diff keeps the topics and lesson names.
 * All of them keep the phase end dates the learner saw, and Today asks before moving them when
 * keeping them leaves lessons out by the goal's date (see `updatePhaseDatesProposal`), except when
 * lessons a phase's challenge tests slip past its day: the challenge comes the first study day
 * after them, and the change names the end that moved (see `getEstimateChange`). Once every lesson is done, a run that would add lessons
 * changes nothing: the Plan offers them (see `addsLessonsAfterLessonsDone`).
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
  retryOnConflict = true,
  settleOnly = false,
}: {
  goalId: string;
  /** `sampled` after the learner's progress (a session ended); `saved` otherwise. */
  pace?: "sampled" | "saved";
  /** Building a day while a page renders can't clear caches, and has none to clear. */
  revalidation?: PlanTagRevalidation;
  /** Deferred work stops on a lost CAS; the next learner action owns recovery. */
  retryOnConflict?: boolean;
  /**
   * Building a day only settles what earlier days left: opening the app with nothing new changes
   * nothing. Planned again from its own output, a plan isn't always laid out the same way, and a
   * career plan's first open of Today added lessons and moved its last weeks. A plan never laid
   * out is still laid out (see `isPlanLaidOut`).
   */
  settleOnly?: boolean;
}): Promise<PlanRefreshResult> {
  const refresh = async (): Promise<PlanRefreshResult> => {
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

    const left = await loadLeftWork(context);

    if (left.length > 0) {
      return settleLeftWork({ context, left, pace, revalidation });
    }

    if (settleOnly && isPlanLaidOut(context)) {
      return { status: "unchanged" };
    }

    const { computed, mode, planned } = await computeRefreshedPlan({ context, pace });

    if (computed.inputsKey === context.plan.inputsKey) {
      await withdrawUnneededPhaseDatesProposal({ computed, context, revalidation });
      return { status: "unchanged" };
    }

    if (addsLessonsAfterLessonsDone({ computed, context })) {
      return { status: "unchanged" };
    }

    const change = getEstimateChange({ computed, context });

    const unchanged = !change && isPlanUnchanged({ computed, context });

    await (unchanged
      ? savePlanInputsKey({ context, graph: computed.state.graph, inputsKey: computed.inputsKey })
      : commitPlan({ change, computed, context, revalidation }));

    // Moving the dates is planned from the day the run planned from, to compare: from today, whose
    // time was still open, a career plan's lessons fit before their challenges, and Today asked
    // nothing while the plan held them after (career 2131).
    await updatePhaseDatesProposal({
      computed,
      context: planned,
      mode,
      pace,
      revalidation,
      writeVersion: {
        ...context.plan,
        inputVersion: context.plan.inputVersion + 1,
        version: context.plan.version + (unchanged ? 0 : 1),
      },
    });

    return { status: unchanged ? "unchanged" : "refreshed" };
  };

  return retryOnConflict ? withPlanRetry(refresh) : refresh();
}
