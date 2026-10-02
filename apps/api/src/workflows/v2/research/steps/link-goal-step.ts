import {
  linkGoalToExamBlueprint,
  linkGoalToResearchSources,
} from "@zoonk/core/library/exams/learners";

/** Points the learner's goal at the exam blueprint research found or built. */
export async function linkGoalToBlueprintStep(input: {
  examBlueprintId: string;
  goalId: string;
}): Promise<boolean> {
  "use step";

  return linkGoalToExamBlueprint(input);
}

/** Records the sources research found for a goal about a law or a product. */
export async function linkGoalToSourcesStep(input: {
  goalId: string;
  sourceIds: string[];
}): Promise<void> {
  "use step";

  await linkGoalToResearchSources(input);
}
