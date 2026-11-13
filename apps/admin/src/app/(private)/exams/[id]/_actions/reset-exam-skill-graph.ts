"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { resetExamSkillGraphForAdmin } from "@zoonk/core/library/curriculum/exam-skill-graph-reset";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function resetExamSkillGraphAction(
  formData: FormData,
): Promise<{ error: string | null }> {
  await assertAdmin();

  const examBlueprintId = parseFormField(formData, "examBlueprintId") ?? "";
  const result = await resetExamSkillGraphForAdmin({ examBlueprintId });

  if (result.status !== "reset") {
    return { error: "This exam has no skill graph to reset." };
  }

  revalidatePath(`/exams/${examBlueprintId}`);
  return { error: null };
}
