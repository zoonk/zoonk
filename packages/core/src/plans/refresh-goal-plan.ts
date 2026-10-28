import "server-only";
import { isDeepStrictEqual } from "node:util";
import { isPlanReady } from "./_utils/apply-plan-change";
import { wasLastDayStudied } from "./_utils/carried-lessons";
import { commitPlan } from "./_utils/commit-plan";
import { getEstimateChange } from "./_utils/estimate-change";
import { loadLeftWork } from "./_utils/left-work";
import {
  preparePhaseDatesProposal,
  withdrawUnneededPhaseDatesProposal,
} from "./_utils/phase-dates-proposal";
import { type PlanContext } from "./_utils/plan-context";
import { addsLessonsAfterLessonsDone, isPlanLaidOut } from "./_utils/plan-refresh-admission";
import { getPlanSummaryBasis, readFreshPlanSummary } from "./_utils/plan-summary";
import { loadPlanAtToken } from "./_utils/plan-token";
import { isPlanUnchanged } from "./_utils/plan-unchanged";
import { prepareRetainedPlanWrite } from "./_utils/prepare-plan-write";
import { type ComputedPlan, type PlanTagRevalidation, computePlan } from "./_utils/replan";
import { getSettledPlanChange } from "./_utils/settled-change";
import { computeSettledPlan } from "./_utils/settled-plan";
import { savePlanInputsKey } from "./_utils/write-plan";
import { isPlanConflictError, withPlanRetry } from "./plan-conflict";
import { addDays } from "./planner/plan-calendar";

type PlanRefreshResult = { status: "notFound" | "notReady" | "paused" | "refreshed" | "unchanged" };

/**
 * A refresh's result, and the plan it worked out when that's the learner's plan now: saved, or
 * waiting to be saved because another write won. Null when the saved plan stays as it is.
 */
type PlannedRefresh = PlanRefreshResult & { plan: ComputedPlan | null };

/**
 * How a refresh saves what it worked out (see `saveOrLetGo`): `throw` when another write won, or
 * `letGo` for a reader that only needs the plan worked out (see `planGoalForPick`).
 */
type LostSave = "letGo" | "throw";

/**
 * Saves through `write`. A save another write won throws, unless the refresh lets it go: then it
 * says so (false), for the refresh to stop saving and hand back the plan it worked out.
 */
async function saveOrLetGo(lostSave: LostSave, write: () => Promise<unknown>): Promise<boolean> {
  if (lostSave === "throw") {
    await write();
    return true;
  }

  const [saved] = await Promise.allSettled([write()]);

  if (saved.status === "fulfilled") {
    return true;
  }

  const reason: unknown = saved.reason;

  if (isPlanConflictError(reason)) {
    return false;
  }

  throw reason;
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
  lostSave,
  pace,
  revalidation,
}: {
  context: PlanContext;
  left: PlanContext["items"];
  lostSave: LostSave;
  pace: "sampled" | "saved";
  revalidation: PlanTagRevalidation;
}): Promise<PlannedRefresh> {
  const missed = !(await wasLastDayStudied(context));
  const computed = await computeSettledPlan({ context, missed, pace });

  await saveOrLetGo(lostSave, () =>
    commitPlan({
      change: getSettledPlanChange({ computed, context, left }),
      computed,
      context,
      phaseDates: { mode: "forced", pace },
      revalidation,
    }),
  );

  return { plan: computed, status: "refreshed" };
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
}): Promise<{ computed: ComputedPlan; mode: "automatic" | "forced"; planned: PlanContext } | null> {
  const fresh = readFreshPlanSummary({
    basis: getPlanSummaryBasis(context),
    value: context.plan.summary,
  });

  const request = { context, mode: "automatic" as const, pace };

  const automatic = fresh
    ? await computePlan({ ...request, skipUnchangedInputs: true })
    : await computePlan(request);

  if (!automatic) {
    return null;
  }

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
 * keeping them leaves lessons out by the goal's date (see `preparePhaseDatesProposal`), except when
 * lessons a phase's challenge tests slip past its day: the challenge comes the first study day
 * after them, and the change names the end that moved (see `getEstimateChange`). Once every lesson is done, a run that would add lessons
 * changes nothing: the Plan offers them (see `addsLessonsAfterLessonsDone`).
 * A refresh outside session completion uses the saved pace (`saved`). Writes
 * nothing when the run plans from what the saved plan was planned from (see `getPlanInputsKey`):
 * laid out another way than the run that saved it, an OAB plan a focus re-planned that morning
 * moved 600 items with nothing new. Writes nothing either when the work and its time stayed the
 * same, wherever a new run would lay it. Does nothing for paused goals or plans not built yet.
 */
export async function refreshGoalPlan({
  retryOnConflict = true,
  ...input
}: RefreshInput & {
  /** Deferred work stops on a lost CAS; the next learner action owns recovery. */
  retryOnConflict?: boolean;
}): Promise<PlanRefreshResult> {
  const refresh = async (): Promise<PlanRefreshResult> => {
    const { status } = await refreshPlanned({ ...input, lostSave: "throw" });
    return { status };
  };

  return retryOnConflict ? withPlanRetry(refresh) : refresh();
}

/**
 * The goal's plan worked out from what it plans from now, for a reader that picks lessons from it
 * (see `pickSpeculativeLessons`): refreshed as any refresh (see `refreshGoalPlan`), its saves tried
 * once and let go when another write won, which the learner's own onboarding keeps doing, so a
 * pick never waits on them: what the plan plans from is the same either way, and the run that
 * wrote meanwhile, or the next refresh, saves it. `plan` is null when the saved plan stays as it
 * is (not built yet, nothing new to plan, or lessons waiting for the learner's OK), and the status
 * says when there's no plan to pick from at all (no goal, or a paused one).
 */
export async function planGoalForPick(goalId: string): Promise<PlannedRefresh> {
  return refreshPlanned({ goalId, lostSave: "letGo" });
}

type RefreshInput = {
  goalId: string;
  /** `sampled` after the learner's progress (a session ended); `saved` otherwise. */
  pace?: "sampled" | "saved";
  /** Session completion keeps its result visible until the learner closes it. */
  revalidation?: PlanTagRevalidation;
  /**
   * Building a day only settles what earlier days left: opening the app with nothing new changes
   * nothing. Planned again from its own output, a plan isn't always laid out the same way, and a
   * career plan's first open of Today added lessons and moved its last weeks. A plan never laid
   * out is still laid out (see `isPlanLaidOut`).
   */
  settleOnly?: boolean;
};

/** One refresh (see `refreshGoalPlan`), with the plan it worked out. */
async function refreshPlanned({
  goalId,
  lostSave,
  pace = "saved",
  revalidation = "now",
  settleOnly = false,
}: RefreshInput & { lostSave: LostSave }): Promise<PlannedRefresh> {
  const context = await loadPlanAtToken(goalId);

  if (!context) {
    return { plan: null, status: "notFound" };
  }

  if (context.goal.status !== "active") {
    return { plan: null, status: "paused" };
  }

  if (!isPlanReady(context)) {
    return { plan: null, status: "notReady" };
  }

  const left = await loadLeftWork(context);

  if (left.length > 0) {
    return settleLeftWork({ context, left, lostSave, pace, revalidation });
  }

  if (settleOnly && isPlanLaidOut(context)) {
    return { plan: null, status: "unchanged" };
  }

  const refreshed = await computeRefreshedPlan({ context, pace });

  if (!refreshed) {
    await saveOrLetGo(lostSave, () =>
      withdrawUnneededPhaseDatesProposal({ context, revalidation }),
    );

    return { plan: null, status: "unchanged" };
  }

  return saveRefreshedPlan({ context, lostSave, pace, refreshed, revalidation });
}

async function saveRefreshedPlan({
  context,
  refreshed,
  lostSave,
  pace,
  revalidation,
}: {
  context: PlanContext;
  refreshed: NonNullable<Awaited<ReturnType<typeof computeRefreshedPlan>>>;
  lostSave: LostSave;
  pace: "sampled" | "saved";
  revalidation: PlanTagRevalidation;
}): Promise<PlannedRefresh> {
  const { computed, mode, planned } = refreshed;

  if (
    computed.inputsKey === context.plan.inputsKey &&
    readFreshPlanSummary({ basis: getPlanSummaryBasis(context), value: context.plan.summary })
  ) {
    await saveOrLetGo(lostSave, () =>
      withdrawUnneededPhaseDatesProposal({ computed, context, revalidation }),
    );

    // The saved plan stays as it is, laid out as it was saved.
    return { plan: null, status: "unchanged" };
  }

  // The lessons it would add wait for the learner's OK: the plan stays as it was saved.
  if (addsLessonsAfterLessonsDone({ computed, context })) {
    const quoted =
      pace === "sampled"
        ? await computePlan({ context, mode: "automatic", pace: "saved" })
        : computed;

    const retained = await prepareRetainedPlanWrite({ computed: quoted, context });

    await saveOrLetGo(lostSave, () =>
      savePlanInputsKey({
        context,
        graph: context.state.graph,
        inputsKey: quoted.inputsKey,
        previews: retained.previews,
        summary: retained.summary,
      }),
    );

    return { plan: null, status: "unchanged" };
  }

  const change = getEstimateChange({ computed, context });

  const unchanged = !change && isPlanUnchanged({ computed, context });

  const retained = unchanged ? await prepareRetainedPlanWrite({ computed, context }) : null;

  const phaseWrite = unchanged
    ? await preparePhaseDatesProposal({
        computed,
        context: {
          ...planned,
          plan: { ...context.plan, inputVersion: context.plan.inputVersion + 1 },
        },
        mode,
        pace,
      })
    : null;

  const saved = await saveOrLetGo(lostSave, () =>
    retained
      ? savePlanInputsKey({
          context,
          extraWrites: phaseWrite ?? undefined,
          graph: computed.state.graph,
          inputsKey: computed.inputsKey,
          previews: retained.previews,
          summary: retained.summary,
        })
      : commitPlan({ change, computed, context, phaseDates: { mode, pace }, revalidation }),
  );

  if (!saved) {
    return { plan: computed, status: "refreshed" };
  }

  // An unchanged plan keeps the layout it was saved with; only its inputs' key was saved.
  return { plan: unchanged ? null : computed, status: unchanged ? "unchanged" : "refreshed" };
}

/** Undo keeps its exact allocation; only current advice and waiting quotes are recomputed. */
export async function refreshSavedGoalPlanAdvice(goalId: string): Promise<void> {
  await withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId);

    if (!context || !isPlanReady(context)) {
      return;
    }

    const computed = await computePlan({ context, mode: "automatic", pace: "saved" });
    const retained = await prepareRetainedPlanWrite({ computed, context });

    await savePlanInputsKey({
      context,
      graph: context.state.graph,
      inputsKey: computed.inputsKey,
      previews: retained.previews,
      summary: retained.summary,
    });
  });
}
