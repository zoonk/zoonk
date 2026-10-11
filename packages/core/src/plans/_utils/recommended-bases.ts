import "server-only";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@zoonk/db";
import { type PlanBases } from "../planner/plan-bases";
import { type StoredBaseChoice } from "../planner/plan-state";
import { isPlanReady } from "./apply-plan-change";
import { listListeningPastBasicsAreas, withPastBasicsAreas } from "./level-listening-starts";
import { type PlanContext, loadPlanContext } from "./plan-context";
import { ensureQuickBaseLessons } from "./quick-bases";
import { type ComputedPlan, commitPlan, computePlan, withPlanRetry } from "./replan";

/**
 * The choices the app recommends for the plan's bases (see `adviseOnBases`), as stored: their core
 * is the default, which isn't.
 */
function toRecommendedChoices(bases: PlanBases): StoredBaseChoice[] {
  const { recommended } = bases;

  return recommended === "essential"
    ? []
    : bases.bases
        .filter((base) => !base.known)
        .map((base) => ({ choice: recommended, skillId: base.skillId }));
}

/**
 * A plan the learner hasn't seen yet starts on the app's recommendation for its bases: every lesson
 * when the time covers everything, a quick lesson for each when the date is close and the time
 * short, else their core. Planned again
 * with those choices when they aren't the ones it has; from then on the choices are the learner's,
 * and recommendations are only shown.
 */
export async function startOnRecommendedBases({
  computed,
  context,
}: {
  computed: ComputedPlan;
  context: PlanContext;
}): Promise<ComputedPlan> {
  const choices = toRecommendedChoices(computed.bases);

  if (isDeepStrictEqual(choices, computed.state.settings.baseChoices)) {
    return computed;
  }

  const settings = { ...computed.state.settings, baseChoices: choices };
  await ensureQuickBaseLessons(settings);

  return computePlan({ context, mode: "forced", state: { ...computed.state, settings } });
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
    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    const context = goal ? await loadPlanContext({ goal }) : null;

    if (!context || !isPlanReady(context)) {
      return;
    }

    const { state } = context;
    const studiesEverything = goal?.kind === "exam" && fullCourse !== undefined;

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
