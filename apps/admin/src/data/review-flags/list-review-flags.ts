import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/** The queue shows the newest changes first; older open flags wait on the next page load. */
const MAX_OPEN_FLAGS = 200;

const cachedListOpenReviewFlags = cacheAdminData(async () =>
  prisma.contentReviewFlag.findMany({
    include: {
      item: { select: { format: true, id: true, skillId: true, sourceCitation: true } },
      lesson: { select: { id: true, title: true } },
      notice: {
        include: {
          examBlueprint: { select: { id: true, name: true } },
          source: { select: { id: true, title: true, url: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: MAX_OPEN_FLAGS,
    where: { status: "open" },
  }),
);

export type AdminReviewFlag = Awaited<ReturnType<typeof listOpenReviewFlags>>[number];

/**
 * Lessons and questions built on a source that changed after they were written, waiting for the
 * daily rewrite or an admin's decision, newest change first.
 */
export async function listOpenReviewFlags() {
  return cachedListOpenReviewFlags();
}

const cachedCountOpenReviewFlags = cacheAdminData(
  async (target: { itemId: string } | { lessonId: string }) =>
    prisma.contentReviewFlag.count({ where: { ...target, status: "open" } }),
);

/** Open flags on one lesson or question, for its admin page. */
export async function countOpenReviewFlags(target: { itemId: string } | { lessonId: string }) {
  return cachedCountOpenReviewFlags(target);
}
