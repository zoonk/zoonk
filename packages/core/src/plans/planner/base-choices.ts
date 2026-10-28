import { type BuildPlanInput } from "./build-plan";
import { type PlanBases, adviseOnBases, findPlanBases } from "./plan-bases";
import { fitsInDepth } from "./plan-feasibility";

export function chooseBases(input: BuildPlanInput): {
  advise: () => PlanBases;
  input: BuildPlanInput;
} {
  const bases = findPlanBases({ ...input, topicLevels: input.topicLevels ?? [] });
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
