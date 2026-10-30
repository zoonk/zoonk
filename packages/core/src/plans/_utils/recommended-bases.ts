import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { parsePlanSettings } from "../planner/plan-state";
import { toRecommendedBaseChoices } from "../planner/recommended-base-choices";
import { refreshGoalPlan } from "../refresh-goal-plan";
import { isPlanReady } from "./apply-plan-change";
import { withPastBasicsAreas } from "./level-listening-starts";
import { listChosenStartAreas, listListeningPastBasicsAreas } from "./load-listening-starts";
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

async function hasChosenBases(planId: string, tx: TransactionClient): Promise<boolean> {
  const chosen = await tx.planChange.findFirst({
    select: { id: true },
    where: {
      payload: { array_contains: [{ kind: "setBaseChoices" }], path: ["operations"] },
      planId,
    },
  });

  return chosen !== null;
}

export async function settleNewPlan({ goalId }: { goalId: string }): Promise<void> {
  const context = await loadPlanAtToken(goalId);

  if (!context || !isPlanReady(context)) {
    return;
  }

  const levelStarts = await listListeningPastBasicsAreas({
    goal: context.goal,
    graph: context.state.graph,
    planId: context.plan.id,
  });

  const state = withPastBasicsAreas({ areas: levelStarts, state: context.state });
  const computed = await computePlan({ context, mode: "forced", state });
  const baseChoices = toRecommendedBaseChoices(computed.bases);

  const settings = await writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId: context.goal.userId },
    async (tx) => {
      const plan = await tx.plan.findUnique({ where: { goalId } });

      if (!plan) {
        return unchanged(null);
      }

      const current = parsePlanSettings(plan.settings);

      const chosenStarts =
        levelStarts.length > 0 ? await listChosenStartAreas(plan.id, tx) : new Set<string>();

      const selected = {
        ...current,
        ...(!(await hasChosenBases(plan.id, tx)) && { baseChoices }),
        pastBasicsAreas: [
          ...new Set([
            ...current.pastBasicsAreas,
            ...levelStarts.filter((area) => !chosenStarts.has(area)),
          ]),
        ],
      };

      if (isDeepStrictEqual(current, selected)) {
        return unchanged(current);
      }

      await tx.plan.update({ data: { settings: selected }, where: { id: plan.id } });
      return selected;
    },
  );

  if (settings) {
    await ensureQuickBaseLessons(settings);
  }

  await refreshGoalPlan({ goalId, mode: "forced", onConflict: "yield" });
}
