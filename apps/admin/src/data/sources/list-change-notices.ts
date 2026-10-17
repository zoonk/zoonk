import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/** A source changes a few times a year; this covers years of history. */
const MAX_CHANGE_NOTICES = 50;

type ChangeNoticeOwner = "exam" | "source";

const cachedListChangeNotices = cacheAdminData(async (owner: ChangeNoticeOwner, id: string) =>
  prisma.sourceChangeNotice.findMany({
    include: { examBlueprint: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: MAX_CHANGE_NOTICES,
    where: owner === "exam" ? { examBlueprintId: id } : { sourceId: id },
  }),
);

export type AdminChangeNotice = Awaited<ReturnType<typeof listChangeNotices>>[number];

/**
 * The lines shown to learners after a new fetch changed an exam or source,
 * newest first. For an exam this is its edition history.
 */
export async function listChangeNotices({ id, owner }: { id: string; owner: ChangeNoticeOwner }) {
  return cachedListChangeNotices(owner, id);
}
