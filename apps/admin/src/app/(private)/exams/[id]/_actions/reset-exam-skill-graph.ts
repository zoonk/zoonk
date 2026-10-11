"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { resetExamSkillGraphForAdmin } from "@zoonk/core/library/curriculum/exam-skill-graph-reset";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export type ResetExamSkillGraphState = {
  error: string | null;
  reset: boolean;
  submissionId: number;
};

/**
 * Resets an exam's shared skill graph, the only way one is rewritten: the exam's next learner
 * writes a new graph, which becomes the exam's. Core checks the admin role again.
 */
export async function resetExamSkillGraphAction(
  previousState: ResetExamSkillGraphState,
  formData: FormData,
): Promise<ResetExamSkillGraphState> {
  await assertAdmin();

  const submissionId = previousState.submissionId + 1;
  const examBlueprintId = parseFormField(formData, "examBlueprintId") ?? "";
  const result = await resetExamSkillGraphForAdmin({ examBlueprintId });

  if (result.status !== "reset") {
    return { error: "This exam has no skill graph to reset.", reset: false, submissionId };
  }

  revalidatePath(`/exams/${examBlueprintId}`);
  return { error: null, reset: true, submissionId };
}
