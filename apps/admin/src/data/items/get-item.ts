import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { redactSourceTitle } from "@/data/sources/_utils/source-title";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

const cachedGetItem = cacheAdminData(async (itemId: string) => {
  const item = await prisma.item.findUnique({
    include: {
      answerExplanations: { orderBy: { createdAt: "desc" } },
      examBlueprint: { select: { id: true, name: true } },
      skill: { select: { id: true, language: true, name: true } },
      source: { select: { id: true, title: true, visibility: true } },
    },
    where: { id: itemId },
  });

  return item ? { ...item, source: item.source ? redactSourceTitle(item.source) : null } : null;
});

export type AdminItem = NonNullable<Awaited<ReturnType<typeof getItem>>>;

/**
 * One item with its skill, the exam and source it was drawn from and the
 * shared explanations written for wrong typed or spoken answers.
 */
export async function getItem(itemId: string) {
  return cachedGetItem(itemId);
}

const cachedCountItemMistakes = cacheAdminData(async (itemId: string) => {
  const rows = await prisma.mistake.groupBy({
    _count: { id: true },
    by: ["status"],
    where: { itemId, ...trackedAnalyticsUserRelationWhere },
  });

  const countStatus = (status: "fixed" | "open") =>
    rows.find((row) => row.status === status)?._count.id ?? 0;

  return { fixed: countStatus("fixed"), open: countStatus("open") };
});

/** Mistakes notebook entries for the item that learners still have open or already fixed. */
export async function countItemMistakes(itemId: string) {
  return cachedCountItemMistakes(itemId);
}
