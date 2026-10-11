import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/** The page lists the newest deletions; older ones show up as newer ones are marked. */
const MAX_PENDING_DELETIONS = 200;

/** Deleted accounts whose analytics still wait to be removed from PostHog, newest first. */
export const listPendingAccountDeletions = cacheAdminData(async () =>
  prisma.accountDeletion.findMany({
    orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
    take: MAX_PENDING_DELETIONS,
    where: { analyticsRemovedAt: null },
  }),
);
