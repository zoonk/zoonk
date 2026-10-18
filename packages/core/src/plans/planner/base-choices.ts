import { type BuildPlanInput } from "./build-plan";
import { type PlanBases, adviseOnBases, findPlanBases } from "./plan-bases";
import { fitsInDepth } from "./plan-feasibility";

/**
 * The plan's bases (see `findPlanBases`) on the planner's input, which studies each as the learner
 * chose (see `buildPlan`), with `advise`, which says what the app recommends (see
 * `adviseOnBases`): whether the learner's time covers everything with every base in depth.
 */
export function chooseBases(input: BuildPlanInput): {
  advise: () => PlanBases;
  input: BuildPlanInput;
} {
  const bases = findPlanBases({ ...input, topicLevels: input.topicLevels ?? [] });
  // Without its bases, the planner plans every skill whole: each base in depth.
  const learned = { ...input, bases: [], settings: { ...input.settings, baseChoices: [] } };

  return {
    advise: () =>
      adviseOnBases({
        bases,
        fits: () => fitsInDepth(learned),
        targetDate: input.goal.targetDate,
        today: input.today,
      }),
    input: { ...input, bases },
  };
}
