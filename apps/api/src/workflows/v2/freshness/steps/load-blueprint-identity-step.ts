import { type ExamIdentity, getSharedExamIdentity } from "@zoonk/core/library/exams/identity";

/** The stored exam's identity, so its new notice updates the same blueprint. */
export async function loadBlueprintIdentityStep(
  examBlueprintId: string,
): Promise<ExamIdentity | null> {
  "use step";

  return getSharedExamIdentity(examBlueprintId);
}
