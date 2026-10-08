import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  type ContentFeedbackReason,
  type FeedbackContentKind,
  type VoteValue,
  prisma,
} from "@zoonk/db";
import { findContentFeedbackHrefs, toContentKey } from "./_utils/content-feedback-hrefs";
import {
  type ContentFeedbackFilters,
  buildContentFeedbackWhere,
} from "./_utils/content-feedback-where";

const learnerSelect = { email: true, id: true, name: true, username: true } as const;

const cachedListContentFeedback = cacheAdminData(
  async (
    limit: number,
    offset: number,
    contentKind?: FeedbackContentKind,
    vote?: VoteValue,
    reason?: ContentFeedbackReason,
    model?: string,
    promptVersion?: string,
  ) => {
    const where = buildContentFeedbackWhere({ contentKind, model, promptVersion, reason, vote });

    const [rows, total] = await Promise.all([
      prisma.contentFeedback.findMany({
        include: { user: { select: learnerSelect } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.contentFeedback.count({ where }),
    ]);

    const hrefs = await findContentFeedbackHrefs(rows);

    /**
     * Comments are personal data, so a queue row keeps only whether there is one. The text never
     * leaves this function and shows only on the detail page, behind a disclosure.
     */
    const feedback = rows.map(({ comment, ...row }) => ({
      ...row,
      contentHref: hrefs.get(toContentKey(row)) ?? null,
      hasComment: Boolean(comment),
    }));

    return { feedback, total };
  },
);

/** Newest votes first, narrowed by the queue's filters. */
export async function listContentFeedback({
  filters,
  limit,
  offset,
}: {
  filters: ContentFeedbackFilters;
  limit: number;
  offset: number;
}) {
  return cachedListContentFeedback(
    limit,
    offset,
    filters.contentKind,
    filters.vote,
    filters.reason,
    filters.model,
    filters.promptVersion,
  );
}

export type ListedContentFeedback = Awaited<
  ReturnType<typeof listContentFeedback>
>["feedback"][number];
