import { type ExamIdentity, getSharedExamNotice } from "@zoonk/core/library/exams/identity";

/** A shared exam with the notice its stored reading came from (`getSharedExamNotice`). */
export async function loadBlueprintNoticeStep(
  examBlueprintId: string,
): Promise<{ identity: ExamIdentity; sourceId: string } | null> {
  "use step";

  return getSharedExamNotice(examBlueprintId);
}
