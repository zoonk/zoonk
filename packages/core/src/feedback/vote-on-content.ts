import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../users/get-session";
import { findContentProvenance } from "./_utils/content-provenance";
import { type ContentVote, toContentVote } from "./_utils/content-vote-view";
import { type ContentVoteInput } from "./contract";

type VoteOnContentResult =
  | { status: "unauthorized" }
  | { status: "notFound" }
  | { status: "voted"; vote: ContentVote };

/**
 * Stores the signed-in learner's vote on one piece of AI content. There is one vote per learner and
 * content, so voting again replaces the vote, its reasons and comment, and refreshes the snapshot of
 * the model, prompt version and run behind the content, which may have been regenerated since.
 */
export async function voteOnContent(input: ContentVoteInput): Promise<VoteOnContentResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const { contentId, contentKind, vote } = input;

  const provenance = await findContentProvenance({ contentId, contentKind, userId });

  if (!provenance) {
    return { status: "notFound" };
  }

  const data = {
    ...provenance,
    comment: input.comment || null,
    language: input.language ?? null,
    reasons: vote === "down" ? [...new Set(input.reasons)] : [],
    vote,
  };

  const feedback = await prisma.contentFeedback.upsert({
    create: { ...data, contentId, contentKind, userId },
    update: data,
    where: { userContent: { contentId, contentKind, userId } },
  });

  return { status: "voted", vote: toContentVote({ ...feedback, vote }) };
}
