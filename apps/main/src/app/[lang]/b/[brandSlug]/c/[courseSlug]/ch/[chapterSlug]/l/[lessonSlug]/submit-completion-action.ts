"use server";

import { submitPlayerCompletion } from "@zoonk/core/player/commands/submit-player-completion";
import {
  type CompletionInput,
  completionInputSchema,
} from "@zoonk/core/player/contracts/completion-input-schema";
import { getSession } from "@zoonk/core/users/session/get";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";

/**
 * Validates and persists a lesson completion in the background.
 *
 * The client computes metrics (BP, energy, belt) locally for instant display.
 * This server action handles the authoritative validation and DB persistence
 * via `after()`, so the response returns immediately after the auth check.
 */
export async function submitCompletion(rawInput: CompletionInput): Promise<void> {
  const parsed = completionInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return;
  }

  const input = parsed.data;

  const reqHeaders = await headers();
  const session = await getSession(reqHeaders);

  if (!session) {
    return;
  }

  const userId = session.user.id;

  // Revalidate outside after() so the signal is included in the RSC response.
  // This tells the client Router Cache to purge the localized catalog layout,
  // whose Continue links are derived from lesson progress and can otherwise
  // keep pointing at the old lesson.
  // Placing it inside after() would run it after the response is sent,
  // meaning the client never receives the invalidation signal.
  revalidatePath("/[lang]/(catalog)", "layout");

  after(async () => {
    try {
      await submitPlayerCompletion({ input, userId });
    } catch (error) {
      logError("[submitCompletion] Failed to persist lesson completion:", error);
    }
  });
}
