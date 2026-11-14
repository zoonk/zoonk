import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { loadContentFixLocations } from "./content-fix-locations";

const MAX_PENDING = 100;
const MAX_DECIDED = 50;

const fixSelect = {
  batchId: true,
  createdAt: true,
  decidedAt: true,
  decider: { select: { name: true } },
  id: true,
  proposer: { select: { name: true } },
  reason: true,
  revertedBy: { select: { id: true, status: true }, where: { status: "applied" } },
  revertsId: true,
  status: true,
  unit: true,
  unitId: true,
} as const;

async function loadBatchSizes(batchIds: string[]): Promise<Map<string, number>> {
  const groups = await prisma.contentFix.groupBy({
    _count: { id: true },
    by: ["batchId"],
    where: { batchId: { in: [...new Set(batchIds)] } },
  });

  return new Map(groups.map((group) => [group.batchId, group._count.id]));
}

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

  const fixes = [...pending, ...decided];

  const [locate, batchSizes] = await Promise.all([
    loadContentFixLocations(fixes),
    loadBatchSizes(fixes.map((fix) => fix.batchId)),
  ]);

  const withPlace = (fix: (typeof fixes)[number]) => ({
    ...fix,
    batchSize: batchSizes.get(fix.batchId) ?? 1,
    location: locate(fix),
  });

  return {
    decided: decided.map((fix) => withPlace(fix)),
    pending: pending.map((fix) => withPlace(fix)),
  };
});

export type ContentFixListItem = Awaited<ReturnType<typeof listContentFixes>>["pending"][number];
