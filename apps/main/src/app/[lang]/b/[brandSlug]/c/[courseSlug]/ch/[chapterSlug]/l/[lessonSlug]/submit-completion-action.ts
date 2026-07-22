"use server";

import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { submitPlayerCompletion } from "@zoonk/core/player/commands/submit-player-completion";
import {
  type CompletionInput,
  completionInputSchema,
} from "@zoonk/core/player/contracts/completion-input-schema";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath, updateTag } from "next/cache";
import { getAuthorizedPlayerLesson } from "./authorize-player-lesson";

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

  const input = parsed.data;

  const [lesson, session] = await Promise.all([
    getAuthorizedPlayerLesson(input.lessonId),
    getSession(),
  ]);

  if (!lesson || !session) {
    return;
  }

  const userId = session.user.id;

  try {
    await submitPlayerCompletion({ input, userId });
    updateTag(getUserProgressCacheTag(userId));
    revalidatePath("/[lang]/(catalog)", "layout");
    revalidatePath("/[lang]/(progress)", "layout");
  } catch (error) {
    logError("[submitCompletion] Failed to persist lesson completion:", error);
  }
}
