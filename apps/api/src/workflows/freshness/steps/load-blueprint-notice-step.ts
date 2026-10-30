import { type ExamIdentity, getSharedExamNotice } from "@zoonk/core/library/exams/identity";

export async function loadBlueprintNoticeStep(
  examBlueprintId: string,
): Promise<{ identity: ExamIdentity; sourceId: string } | null> {
  "use step";

  return getSharedExamNotice(examBlueprintId);
}
