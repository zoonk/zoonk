import { type ContentFeedback } from "@zoonk/db";

/** A learner's vote as every screen and the API show it. */
export type ContentVote = Pick<
  ContentFeedback,
  "comment" | "contentId" | "contentKind" | "reasons" | "updatedAt"
> & { vote: NonNullable<ContentFeedback["vote"]> };

/** Serializes a stored row that holds a vote. */
export function toContentVote(feedback: ContentFeedback & Pick<ContentVote, "vote">): ContentVote {
  return {
    comment: feedback.comment,
    contentId: feedback.contentId,
    contentKind: feedback.contentKind,
    reasons: feedback.reasons,
    updatedAt: feedback.updatedAt,
    vote: feedback.vote,
  };
}
