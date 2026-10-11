import { addMissingExamGraphSkills } from "@zoonk/core/library/curriculum/exam-graph-repair";

/**
 * Completes the exam's shared skill graph with skills for the topics the new reading names that
 * none of its skills teaches (`addMissingExamGraphSkills`); nothing when it has none.
 */
export async function addMissingExamSkillsStep(examBlueprintId: string): Promise<string[]> {
  "use step";

  return addMissingExamGraphSkills(examBlueprintId);
}
