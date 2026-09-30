"use server";

import { LANGUAGE_ACTIVITY_TYPES } from "@zoonk/core/language/activities";
import { changeLanguageActivity } from "@zoonk/core/language/activities/skipped";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const inputSchema = z.object({
  activity: z.enum(LANGUAGE_ACTIVITY_TYPES),
  skip: z.boolean(),
  targetLanguage: z.string().min(2).max(10),
  timeZone: z.string().refine(isValidTimeZone).optional(),
});

/**
 * Leaves a kind of language practice out of the learner's plan ("Skip writing"), or brings it
 * back: the same plan change the API's plan changes make. The input is untrusted.
 */
export async function changeLanguageActivityAction(input: unknown): Promise<boolean> {
  const parsed = inputSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const result = await changeLanguageActivity(parsed.data);

  if (result.status !== "applied") {
    return false;
  }

  revalidatePath("/[lang]/plan", "page");
  return true;
}
