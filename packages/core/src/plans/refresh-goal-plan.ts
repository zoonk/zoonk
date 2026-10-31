import "server-only";
import { isDeepStrictEqual } from "node:util";
import { isGoalSetupLeft } from "../view-models/onboarding/onboarding-steps";
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
import { afterPlanInputWrite, isPlanConflictError, withPlanRetry } from "./plan-conflict";
import { addDays } from "./planner/plan-calendar";

type PlanRefreshResult = { status: "notFound" | "notReady" | "paused" | "refreshed" | "unchanged" };

type PlannedRefresh = PlanRefreshResult & { plan: ComputedPlan | null };

type LostSave = "letGo" | "throw";

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

async function computeRefreshedPlan({
  context,
  mode = "automatic",
  pace,
}: {
  context: PlanContext;
  mode?: "automatic" | "forced";
  pace: "sampled" | "saved";
}): Promise<{ computed: ComputedPlan; mode: "automatic" | "forced"; planned: PlanContext } | null> {
  const fresh = readFreshPlanSummary({
    basis: getPlanSummaryBasis(context),
    value: context.plan.summary,
  });

  const request = { context, mode, pace };

  const automatic =
    fresh && mode === "automatic"
      ? await computePlan({ ...request, skipUnchangedInputs: true })
      : await computePlan(request);

  if (!automatic) {
    return null;
  }

  const newPace = !isDeepStrictEqual(automatic.pace, context.state.settings.pace);

  if (pace === "saved" || !newPace || automatic.built.spill <= 0) {
    return { computed: automatic, mode, planned: context };
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
 * Writes nothing when nothing it plans from changed, and does nothing for paused goals or plans not
 * built yet.
 */
export async function refreshGoalPlan({
  onConflict = "retry",
  ...input
}: RefreshInput & { onConflict?: "retry" | "throw" | "yield" }): Promise<PlanRefreshResult> {
  const refresh = async (): Promise<PlanRefreshResult> => {
    const { status } = await refreshPlanned({ ...input, lostSave: "throw" });

    return { status };
  };

  if (onConflict === "yield") {
    return (await afterPlanInputWrite(() => withPlanRetry(refresh))) ?? { status: "unchanged" };
  }

  return onConflict === "retry" ? withPlanRetry(refresh) : refresh();
}

/** Computes without saving during onboarding; otherwise lets go of a save another writer won. */
export async function planGoalForPick(goalId: string): Promise<PlannedRefresh> {
  return refreshPlanned({ goalId, lostSave: "letGo", whenSetup: "compute" });
}

type RefreshInput = {
  goalId: string;
  mode?: "automatic" | "forced";
  whenSetup?: "compute" | "save" | "skip";
  /** For a re-plan that only brings in lessons written meanwhile: the learner's last change stays undoable. */
  keepsOpenUndo?: boolean;
  settleMissedDays?: boolean;
  /** `sampled` after the learner's progress (a session ended); `saved` otherwise. */
  pace?: "sampled" | "saved";
  revalidation?: PlanTagRevalidation;
  settleOnly?: boolean;
};

async function refreshPlanned({
  goalId,
  keepsOpenUndo = false,
  lostSave,
  mode,
  pace = "saved",
  revalidation = "now",
  settleMissedDays = true,
  settleOnly = false,
  whenSetup = "save",
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

  if (whenSetup !== "save" && isGoalSetupLeft(context.goal)) {
    const planned =
      whenSetup === "compute" ? await computeRefreshedPlan({ context, mode, pace }) : null;

    return { plan: planned?.computed ?? null, status: "unchanged" };
  }

  const left = settleMissedDays ? await loadLeftWork(context) : [];

  if (left.length > 0) {
    return settleLeftWork({ context, left, lostSave, pace, revalidation });
  }

  if (settleOnly && isPlanLaidOut(context)) {
    return { plan: null, status: "unchanged" };
  }

  const refreshed = await computeRefreshedPlan({ context, mode, pace });

  if (!refreshed) {
    await saveOrLetGo(lostSave, () =>
      withdrawUnneededPhaseDatesProposal({ context, revalidation }),
    );

    return { plan: null, status: "unchanged" };
  }

  return saveRefreshedPlan({ context, keepsOpenUndo, lostSave, pace, refreshed, revalidation });
}

async function saveRefreshedPlan({
  context,
  keepsOpenUndo,
  refreshed,
  lostSave,
  pace,
  revalidation,
}: {
  context: PlanContext;
  keepsOpenUndo: boolean;
  refreshed: NonNullable<Awaited<ReturnType<typeof computeRefreshedPlan>>>;
  lostSave: LostSave;
  pace: "sampled" | "saved";
  revalidation: PlanTagRevalidation;
}): Promise<PlannedRefresh> {
  const { computed, mode, planned } = refreshed;

  if (
    mode === "automatic" &&
    computed.inputsKey === context.plan.inputsKey &&
    readFreshPlanSummary({ basis: getPlanSummaryBasis(context), value: context.plan.summary })
  ) {
    await saveOrLetGo(lostSave, () =>
      withdrawUnneededPhaseDatesProposal({ computed, context, revalidation }),
    );

    return { plan: null, status: "unchanged" };
  }

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
    ? await preparePhaseDatesProposal({ computed, context: planned, mode, pace })
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
      : commitPlan({
          change,
          computed,
          context,
          keepsOpenUndo,
          phaseDates: { mode, pace },
          revalidation,
        }),
  );

  if (!saved) {
    return { plan: computed, status: "refreshed" };
  }

  return { plan: unchanged ? null : computed, status: unchanged ? "unchanged" : "refreshed" };
}

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
