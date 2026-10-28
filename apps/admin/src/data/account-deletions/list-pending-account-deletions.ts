import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

const MAX_PENDING_DELETIONS = 200;

export const listPendingAccountDeletions = cacheAdminData(async () =>
  prisma.accountDeletion.findMany({
    orderBy: [{ deletedAt: "desc" }, { id: "asc" }],
    take: MAX_PENDING_DELETIONS,
    where: { analyticsRemovedAt: null },
  }),
);
