"use server";

import { completeLesson } from "@zoonk/core/player/commands/create-lesson-completion";
import {
  type CompletionInput,
  completionInputSchema,
} from "@zoonk/core/player/contracts/completion-input-schema";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";

/**
 * Validates and persists a lesson completion before invalidating progress UI.
 *
 * The client computes metrics (BP, energy, belt) locally for instant display.
 * It intentionally doesn't await this action, so the player stays responsive
 * while the server finishes the authoritative write and then clears stale
 * catalog and progress data from the client cache.
 */
export async function submitCompletion(rawInput: CompletionInput): Promise<void> {
  const parsed = completionInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return;
  }

  try {
    const result = await completeLesson(parsed.data);

    if (result.status !== "completed") {
      return;
    }

    revalidatePath("/[lang]/(catalog)", "layout");
    revalidatePath("/[lang]/(progress)", "layout");
  } catch (error) {
    logError("[submitCompletion] Failed to persist lesson completion:", error);
  }
}
