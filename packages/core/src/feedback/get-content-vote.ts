import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../users/get-session";
import { type ContentVote, toContentVote } from "./_utils/content-vote-view";
import { type ContentVoteTarget } from "./contract";

export type ContentVoteReadResult =
  | { status: "unauthorized" }
  | { status: "notVoted" }
  | { status: "voted"; vote: ContentVote };

/**
 * The signed-in learner's own vote on one piece of content, so a screen's menu or thumbs show what
 * they picked before. Uncached: it's read when a menu opens, right after a vote may have changed it.
 */
export async function getContentVote({
  contentId,
  contentKind,
}: ContentVoteTarget): Promise<ContentVoteReadResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const feedback = await prisma.contentFeedback.findUnique({
    where: { userContent: { contentId, contentKind, userId: session.user.id } },
  });

  if (!feedback?.vote) {
    return { status: "notVoted" };
  }

  return { status: "voted", vote: toContentVote({ ...feedback, vote: feedback.vote }) };
}
