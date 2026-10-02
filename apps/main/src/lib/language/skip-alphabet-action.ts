"use server";

import { skipAlphabetIntro } from "@zoonk/core/language/alphabet/skip";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const goalIdSchema = z.uuid();

/**
 * The learner already reads the script: their sessions stop opening with the alphabet lesson, as
 * `POST /v1/goals/{goalId}/alphabet-skips` does. The goal id is untrusted.
 */
export async function skipAlphabetAction(goalId: unknown): Promise<boolean> {
  const parsed = goalIdSchema.safeParse(goalId);

  if (!parsed.success) {
    return false;
  }

  const result = await skipAlphabetIntro(parsed.data);

  if (result.status !== "skipped") {
    return false;
  }

  revalidatePath("/[lang]/content", "page");
  revalidatePath("/[lang]/today", "page");
  return true;
}
