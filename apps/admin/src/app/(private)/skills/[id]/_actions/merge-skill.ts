"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { type AdminActionState } from "@/lib/use-admin-action-state";
import { mergeSkillForAdmin } from "@zoonk/core/library/skills/merge";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

const ERRORS = {
  forbidden: "You can't merge skills.",
  invalid: "These skills can't be merged: they need the same language and audience, and no loop.",
  notFound: "No skill has that id.",
  unauthorized: "You can't merge skills.",
} as const;

export async function mergeSkillAction(
  previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await assertAdmin();

  const submissionId = previousState.submissionId + 1;
  const duplicateId = parseFormField(formData, "duplicateId") ?? "";
  const survivorId = parseFormField(formData, "survivorId") ?? "";

  const result = await mergeSkillForAdmin({ duplicateId, survivorId });

  if (result.status !== "merged") {
    return { error: ERRORS[result.status], submissionId };
  }

  revalidatePath(`/skills/${duplicateId}`);
  revalidatePath(`/skills/${result.survivorId}`);

  return { error: null, submissionId };
}
