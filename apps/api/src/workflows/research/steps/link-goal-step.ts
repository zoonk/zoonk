import {
  linkGoalToExamBlueprint,
  linkGoalToResearchSources,
  refreshFollowerSummaries,
  unlinkGoalFromSharedExam,
} from "@zoonk/core/library/exams/learners";

export async function linkGoalToBlueprintStep(input: {
  examBlueprintId: string;
  goalId: string;
}): Promise<boolean> {
  "use step";

  return linkGoalToExamBlueprint(input);
}

export async function unlinkGoalFromSharedExamStep(goalId: string): Promise<void> {
  "use step";

  await unlinkGoalFromSharedExam(goalId);
}

export async function refreshFollowerSummariesStep(examBlueprintId: string): Promise<void> {
  "use step";

  await refreshFollowerSummaries(examBlueprintId);
}

export async function linkGoalToSourcesStep(input: {
  goalId: string;
  sourceIds: string[];
}): Promise<void> {
  "use step";

  await linkGoalToResearchSources(input);
}
