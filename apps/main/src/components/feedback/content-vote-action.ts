"use server";

import {
  type ContentVoteInput,
  type ContentVoteTarget,
  contentVoteInputSchema,
  contentVoteTargetSchema,
} from "@zoonk/core/feedback/contract";
import { getContentVote } from "@zoonk/core/feedback/get-vote";
import { voteOnContent } from "@zoonk/core/feedback/vote";
import { logError } from "@zoonk/utils/logger";

/**
 * Stores the learner's vote through the same core capability as the public
 * API. The client updates its buttons and sends the analytics event without
 * waiting; visitors who aren't signed in aren't stored.
 */
export async function voteOnContentAction(rawInput: ContentVoteInput): Promise<boolean> {
  const parsed = contentVoteInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return false;
  }

  try {
    const result = await voteOnContent(parsed.data);
    return result.status === "voted";
  } catch (error) {
    logError("[voteOnContentAction] Failed to store the vote:", error);
    return false;
  }
}

/**
 * The learner's earlier vote, so a screen's menu shows what they picked. A failed read shows no
 * vote rather than breaking the menu.
 */
export async function readContentVoteAction(
  rawTarget: ContentVoteTarget,
): Promise<ContentVoteInput["vote"] | null> {
  const parsed = contentVoteTargetSchema.safeParse(rawTarget);

  if (!parsed.success) {
    return null;
  }

  try {
    const result = await getContentVote(parsed.data);
    return result.status === "voted" ? result.vote.vote : null;
  } catch (error) {
    logError("[readContentVoteAction] Failed to read the vote:", error);
    return null;
  }
}
