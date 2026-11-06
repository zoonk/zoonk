"use server";

import { skipAlphabetIntro } from "@zoonk/core/language/alphabet/skip";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { revalidatePath } from "next/cache";

const goalIdSchema = uuidSchema();

export async function skipAlphabetAction(goalId: unknown): Promise<boolean> {
  const parsed = goalIdSchema.safeParse(goalId);

  if (!parsed.success) {
    return false;
  }

  const result = await skipAlphabetIntro(parsed.data);

  if (result.status !== "skipped") {
    return false;
  }

  revalidatePath("/[lang]/plan", "page");
  revalidatePath("/[lang]/today", "page");
  return true;
}
