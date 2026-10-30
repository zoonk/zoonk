import { addMissingExamGraphSkills } from "@zoonk/core/library/curriculum/exam-graph-repair";

export async function addMissingExamSkillsStep(examBlueprintId: string): Promise<string[]> {
  "use step";

  return addMissingExamGraphSkills(examBlueprintId);
}
