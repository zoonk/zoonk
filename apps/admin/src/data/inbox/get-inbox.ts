import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export type InboxQueue = { count: number; oldest: Date | null };

const waiting = { _count: { id: true }, _min: { createdAt: true } } as const;

/**
 * How much waits in each queue, and since when. The sidebar and Home both read it, once per
 * request.
 */
export const getInbox = cacheAdminData(async () => {
  const [feedback, contentFixes, sourceChanges, accountDeletions] = await Promise.all([
    prisma.feedback.aggregate({ ...waiting, where: { status: "new" } }),
    prisma.contentFix.aggregate({ ...waiting, where: { status: "proposed" } }),
    prisma.contentReviewFlag.aggregate({ ...waiting, where: { status: "open" } }),
    prisma.accountDeletion.aggregate({
      _count: { id: true },
      _min: { deletedAt: true },
      where: { analyticsRemovedAt: null },
    }),
  ]);

  return {
    accountDeletions: {
      count: accountDeletions._count.id,
      oldest: accountDeletions._min.deletedAt,
    },
    contentFixes: { count: contentFixes._count.id, oldest: contentFixes._min.createdAt },
    feedback: { count: feedback._count.id, oldest: feedback._min.createdAt },
    sourceChanges: { count: sourceChanges._count.id, oldest: sourceChanges._min.createdAt },
  } satisfies Record<string, InboxQueue>;
});

export type InboxQueueName = keyof Awaited<ReturnType<typeof getInbox>>;
