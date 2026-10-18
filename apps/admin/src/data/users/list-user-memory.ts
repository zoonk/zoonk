import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const RECENT_INSIGHTS = 10;

/**
 * Everything Zoonk remembers about the learner, for support requests: current facts, replaced
 * and deleted ones still kept for undo, and the latest daily insights.
 */
export const listUserMemory = cacheAdminData(async (userId: string) => {
  const [facts, insights] = await Promise.all([
    prisma.memoryFact.findMany({
      omit: { sourceRef: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      where: { userId },
    }),
    prisma.memoryInsight.findMany({
      omit: { payload: true },
      orderBy: { localDate: "desc" },
      take: RECENT_INSIGHTS,
      where: { userId },
    }),
  ]);

  return { facts, insights };
});

export type UserMemory = Awaited<ReturnType<typeof listUserMemory>>;
