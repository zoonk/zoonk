import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  type ContentFeedbackReason,
  type FeedbackContentKind,
  type VoteValue,
  prisma,
} from "@zoonk/db";
import {
  type ContentFeedbackFilters,
  buildContentFeedbackWhere,
} from "./_utils/content-feedback-where";

const cachedGetContentFeedbackSummary = cacheAdminData(
  async (
    contentKind?: FeedbackContentKind,
    vote?: VoteValue,
    reason?: ContentFeedbackReason,
    model?: string,
    promptVersion?: string,
  ) => {
    const rows = await prisma.contentFeedback.groupBy({
      _count: { id: true },
      by: ["vote"],
      where: buildContentFeedbackWhere({ contentKind, model, promptVersion, reason, vote }),
    });

    const countVotes = (value: VoteValue) => rows.find((row) => row.vote === value)?._count.id ?? 0;

    return { down: countVotes("down"), up: countVotes("up") };
  },
);

/** Helpful and not helpful votes in the filtered set, for the summary above the queue. */
export async function getContentFeedbackSummary(filters: ContentFeedbackFilters) {
  return cachedGetContentFeedbackSummary(
    filters.contentKind,
    filters.vote,
    filters.reason,
    filters.model,
    filters.promptVersion,
  );
}
