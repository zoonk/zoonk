import "server-only";
import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { generateGoalOpening } from "@zoonk/ai/tasks/curriculum/goal-opening";
import { type CurriculumAnalytics, type CurriculumScope, getScopeModel } from "./curriculum-scope";
import { type GoalCurriculumInputs } from "./goal-curriculum-inputs";
import { toScopedGraphPrompt } from "./shared-graph-prompt";

/**
 * Internal workflow bridge: the inputs and scope are the ones the goal's skill graph reads, so a
 * shared opening gets only the goal's general form, never the learner's words.
 */
export async function writeGoalOpening({
  analytics,
  inputs,
  scope,
}: {
  analytics?: CurriculumAnalytics;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}) {
  const { data, provenance } = await generateGoalOpening({
    ...toScopedGraphPrompt({ inputs, scope }),
    analytics,
    libraryInput: !scope.ownerId,
    model: getScopeModel(scope),
    serviceTier: chooseServiceTier({ wait: "learner" }),
  });

  return { ...data, provenance };
}
