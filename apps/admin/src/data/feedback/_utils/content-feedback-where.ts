import { type ContentFeedbackReason, type FeedbackContentKind, type VoteValue } from "@zoonk/db";

export type ContentFeedbackFilters = {
  contentKind?: FeedbackContentKind;
  model?: string;
  promptVersion?: string;
  reason?: ContentFeedbackReason;
  vote?: VoteValue;
};

/** Prisma skips undefined fields, so an unset filter matches every vote. */
export function buildContentFeedbackWhere(filters: ContentFeedbackFilters) {
  return {
    contentKind: filters.contentKind,
    model: filters.model,
    promptVersion: filters.promptVersion,
    reasons: filters.reason ? { has: filters.reason } : undefined,
    vote: filters.vote,
  };
}
