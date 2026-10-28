import { type ExamIdentity, getSharedExamIdentity } from "@zoonk/core/library/exams/identity";

export async function loadBlueprintIdentityStep(
  examBlueprintId: string,
): Promise<ExamIdentity | null> {
  "use step";

  return getSharedExamIdentity(examBlueprintId);
}
