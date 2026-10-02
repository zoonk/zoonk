"use server";

import { moveWeeklyChallenge, undoWeeklyChallengeMove } from "@zoonk/core/checkpoints/move";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { startStudyBlock } from "@zoonk/core/sessions/start-block";

/**
 * Checkpoints start on their own screen, when the learner takes them on, rather than when the
 * session opens them. The input is untrusted, so it's parsed with the API's schema.
 */
export async function startCheckpointAction(
  ids: { blockId: string; sessionId: string },
  timeZone: unknown,
): Promise<boolean> {
  const input = studySessionTimeZoneInputSchema.safeParse({ timeZone });

  if (!input.success) {
    return false;
  }

  const result = await startStudyBlock({ ...ids, input: input.data });
  return result.status === "ready";
}

/** "Move to Monday": the week's challenge moves through the plan; null when it can't. */
export async function moveChallengeAction(
  blockId: string,
  timeZone: unknown,
): Promise<{ changeId: string | null; date: string } | null> {
  const input = studySessionTimeZoneInputSchema.safeParse({ timeZone });

  if (!input.success) {
    return null;
  }

  const result = await moveWeeklyChallenge({ blockId, input: input.data });
  return result.status === "moved" ? result.move : null;
}

/** Undoes the move while the plan is as it left it. */
export async function undoChallengeMoveAction(
  { blockId, changeId }: { blockId: string; changeId: string },
  timeZone: unknown,
): Promise<boolean> {
  const input = studySessionTimeZoneInputSchema.safeParse({ timeZone });

  if (!input.success) {
    return false;
  }

  const result = await undoWeeklyChallengeMove({ blockId, changeId, input: input.data });
  return result.status === "undone";
}
