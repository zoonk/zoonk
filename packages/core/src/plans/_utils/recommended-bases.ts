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

function withRecommendedBases(computed: ComputedPlan): ComputedPlan["state"] | null {
  const choices = toRecommendedBaseChoices(computed.bases);

  return isDeepStrictEqual(choices, computed.state.settings.baseChoices)
    ? null
    : { ...computed.state, settings: { ...computed.state.settings, baseChoices: choices } };
}

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
