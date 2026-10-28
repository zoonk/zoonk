import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@zoonk/db";
import { withPlanRetry } from "../plan-conflict";
import { toRecommendedBaseChoices } from "../planner/recommended-base-choices";
import { isPlanReady } from "./apply-plan-change";
import { commitPlan } from "./commit-plan";
import { withPastBasicsAreas } from "./level-listening-starts";
import { listListeningPastBasicsAreas } from "./load-listening-starts";
import { type PlanContext } from "./plan-context";
import { loadPlanAtToken } from "./plan-token";
import { ensureQuickBaseLessons } from "./quick-bases";
import { type ComputedPlan, computePlan } from "./replan";

/**
 * A plan the learner hasn't seen yet starts on the app's recommendation for its bases: every lesson
 * when the time covers everything, a quick lesson for each when the date is close and the time
 * short, else their core. The state to plan again with those choices, or null when they're the
 * ones it has; from then on the choices are the learner's, and recommendations are only shown.
 */
function withRecommendedBases(computed: ComputedPlan): ComputedPlan["state"] | null {
  const choices = toRecommendedBaseChoices(computed.bases);

  return isDeepStrictEqual(choices, computed.state.settings.baseChoices)
    ? null
    : { ...computed.state, settings: { ...computed.state.settings, baseChoices: choices } };
}

/**
 * The plan on the recommendation for its bases (see `withRecommendedBases`), creating nothing: a
 * quick lesson the Library doesn't have yet plans as its stand-in (see `loadQuickBaseLessons`), for
 * the run to create it after saving the plan, then plan again with it (see `createGoalPlan`).
 */
export async function planOnRecommendedBases({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): Promise<ComputedPlan> {
  const state = withRecommendedBases(computed);
  return state ? computePlan({ context, mode: "forced", state }) : computed;
}

/** The plan on the recommendation for its bases, its quick lessons created first. */
async function startOnRecommendedBases({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): Promise<ComputedPlan> {
  const state = withRecommendedBases(computed);

  if (!state) {
    return computed;
  }

  await ensureQuickBaseLessons(state.settings);
  return computePlan({ context, mode: "forced", state });
}

/** Whether the learner ever chose how to study the plan's bases themselves. */
async function hasChosenBases(planId: string): Promise<boolean> {
  const chosen = await prisma.planChange.findFirst({
    select: { id: true },
    where: {
      payload: { array_contains: [{ kind: "setBaseChoices" }], path: ["operations"] },
      planId,
    },
  });

  return chosen !== null;
}

/**
 * Onboarding's last answer (the learner's time) settles the new plan: it studies everything after
 * its exam when the learner chose that there (`fullCourse`, exams only), a language exam's
 * listening starts past the basics the learner's own word covers (`listListeningPastBasicsAreas`),
 * and its bases follow the app's recommendation for that time unless the learner already chose
 * them. Writes nothing when the plan already is so.
 */
export async function settleNewPlan({
  fullCourse,
  goalId,
}: {
  fullCourse?: boolean;
  goalId: string;
}): Promise<void> {
  await withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId);

    if (!context || !isPlanReady(context)) {
      return;
    }

    const { state } = context;
    const studiesEverything = context.goal.kind === "exam" && fullCourse !== undefined;

    const levelStarts = await listListeningPastBasicsAreas({
      goal: context.goal,
      graph: state.graph,
      planId: context.plan.id,
    });

    const { settings: levelSettings } = withPastBasicsAreas({ areas: levelStarts, state });
    const settings = studiesEverything ? { ...levelSettings, fullCourse } : levelSettings;

    const computed = await computePlan({ context, mode: "forced", state: { ...state, settings } });

    const settled = (await hasChosenBases(context.plan.id))
      ? computed
      : await startOnRecommendedBases({ computed, context });

    if (settled !== computed || settings !== state.settings) {
      await commitPlan({ change: null, computed: settled, context });
    }
  });
}
