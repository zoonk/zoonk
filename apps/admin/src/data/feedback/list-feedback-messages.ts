import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { type FeedbackStatus, prisma } from "@zoonk/db";
import { parseFeedbackMessageContext } from "./_utils/feedback-message-context";

const cachedListFeedbackMessages = cacheAdminData(
  async (limit: number, offset: number, status?: FeedbackStatus) => {
    const where = { status };

    const [rows, total] = await Promise.all([
      prisma.feedback.findMany({
        include: { user: { select: { email: true, id: true, name: true, username: true } } },
        omit: { message: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        where,
      }),
      prisma.feedback.count({ where }),
    ]);

    const messages = rows.map((row) => ({
      ...row,
      context: parseFeedbackMessageContext(row.context),
    }));

    return { messages, total };
  },
);

/** Feedback form messages, newest first. The list leaves out the message text. */
export async function listFeedbackMessages({
  limit,
  offset,
  status,
}: {
  limit: number;
  offset: number;
  status?: FeedbackStatus;
}) {
  return cachedListFeedbackMessages(limit, offset, status);
}

export type ListedFeedbackMessage = Awaited<
  ReturnType<typeof listFeedbackMessages>
>["messages"][number];
