"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { mergeSkillForAdmin } from "@zoonk/core/library/skills/merge";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

const ERRORS = {
  forbidden: "You can't merge skills.",
  invalid: "These skills can't be merged: they need the same language and audience, and no loop.",
  notFound: "That skill no longer exists. Search again.",
  unauthorized: "You can't merge skills.",
} as const;

export async function mergeSkillAction(formData: FormData): Promise<{ error: string | null }> {
  await assertAdmin();

  const duplicateId = parseFormField(formData, "duplicateId") ?? "";
  const survivorId = parseFormField(formData, "survivorId") ?? "";

  const result = await mergeSkillForAdmin({ duplicateId, survivorId });

  if (result.status !== "merged") {
    return { error: ERRORS[result.status] };
  }

  revalidatePath(`/skills/${duplicateId}`);
  revalidatePath(`/skills/${result.survivorId}`);

  return { error: null };
}
