import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { loadContentFixLocations } from "./content-fix-locations";

const MAX_PENDING = 100;
const MAX_DECIDED = 50;

const fixSelect = {
  createdAt: true,
  decidedAt: true,
  decider: { select: { name: true } },
  id: true,
  proposer: { select: { name: true } },
  reason: true,
  revertsId: true,
  status: true,
  unit: true,
  unitId: true,
} as const;

/** Every fix waiting for a decision, then the latest decisions. */
export const listContentFixes = cacheAdminData(async () => {
  const [pending, decided] = await Promise.all([
    prisma.contentFix.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: fixSelect,
      take: MAX_PENDING,
      where: { status: "proposed" },
    }),
    prisma.contentFix.findMany({
      orderBy: [{ decidedAt: "desc" }, { id: "desc" }],
      select: fixSelect,
      take: MAX_DECIDED,
      where: { status: { not: "proposed" } },
    }),
  ]);

  const locate = await loadContentFixLocations([...pending, ...decided]);

  return {
    decided: decided.map((fix) => ({ ...fix, location: locate(fix) })),
    pending: pending.map((fix) => ({ ...fix, location: locate(fix) })),
  };
});

export type ContentFixListItem = Awaited<ReturnType<typeof listContentFixes>>["pending"][number];
