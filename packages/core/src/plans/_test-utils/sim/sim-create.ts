import { isDeepStrictEqual } from "node:util";
import { pickListeningPastBasicsAreas } from "../../_utils/level-listening-starts";
import { type ComputedPlan } from "../../_utils/replan";
import { commitSimPlan, computeSimPlan } from "./sim-planner";
import { type SimPlan, type SimWorld, getSimGoal } from "./sim-world";

/**
 * The pure tier's copy of the plan onboarding leaves: `createGoalPlan` makes it, and
 * `settleNewPlan` settles it at onboarding's last answer. Nothing checks it against them in the
 * normal run: confirm a finding through the database tier.
 */

/** `startOnRecommendedBases`: planned again on the app's recommendation for its bases. */
function startOnSimRecommendedBases({
  computed,
  world,
}: {
  computed: ComputedPlan;
  world: SimWorld;
}): ComputedPlan {
  const { recommended } = computed.bases;

  const choices =
    recommended === "essential"
      ? []
      : computed.bases.bases
          .filter((base) => !base.known)
          .map((base) => ({ choice: recommended, skillId: base.skillId }));

  if (isDeepStrictEqual(choices, computed.state.settings.baseChoices)) {
    return computed;
  }

  return computeSimPlan({
    mode: "forced",
    state: { ...computed.state, settings: { ...computed.state.settings, baseChoices: choices } },
    world,
  });
}

/**
 * `settleNewPlan` without a study-everything answer: the listening areas the learner's word covers
 * start past the basics, and the bases follow the recommendation (the learner chose none yet).
 * Saved only when that changes the plan.
 */
function settleSimPlan(world: SimWorld): SimPlan {
  const { state } = world.plan;

  // `listListeningPastBasicsAreas`: a new plan has no area whose start the learner chose yet.
  const levelAreas = pickListeningPastBasicsAreas({
    chosen: new Set(),
    goal: getSimGoal(world),
    graph: state.graph,
    listening: world.inputs.listeningSkillIds,
  }).filter((area) => !state.settings.pastBasicsAreas.includes(area));

  const settings =
    levelAreas.length > 0
      ? { ...state.settings, pastBasicsAreas: [...state.settings.pastBasicsAreas, ...levelAreas] }
      : state.settings;

  const computed = computeSimPlan({ mode: "forced", state: { ...state, settings }, world });
  const settled = startOnSimRecommendedBases({ computed, world });

  return settled !== computed || settings !== state.settings
    ? commitSimPlan({ computed: settled, world })
    : world.plan;
}

/** A new goal's plan as onboarding leaves it (see the top of this file). */
export function createSimPlan(world: SimWorld): SimPlan {
  const planned = computeSimPlan({ mode: "forced", world });

  const created = commitSimPlan({
    computed: startOnSimRecommendedBases({ computed: planned, world }),
    world,
  });

  return settleSimPlan({ ...world, plan: created });
}
