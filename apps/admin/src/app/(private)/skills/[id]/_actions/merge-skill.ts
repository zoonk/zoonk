"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { mergeSkillForAdmin } from "@zoonk/core/library/skills/merge";
import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";

export async function mergeSkillAction(formData: FormData) {
  await assertAdmin();

  const duplicateId = parseFormField(formData, "duplicateId") ?? "";
  const survivorId = parseFormField(formData, "survivorId")?.trim() ?? "";

  const result = await mergeSkillForAdmin({ duplicateId, survivorId });

  if (result.status !== "merged") {
    throw new Error(
      result.status === "invalid"
        ? "These skills can't be merged: they need the same language and audience, and no loop"
        : "Could not merge this skill",
    );
  }

  revalidatePath(`/skills/${duplicateId}`);
  revalidatePath(`/skills/${result.survivorId}`);
}
