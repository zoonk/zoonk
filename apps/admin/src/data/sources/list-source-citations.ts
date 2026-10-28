import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const MAX_SOURCE_CITATION_ROWS = 50;

const cachedListSourceCitations = cacheAdminData(async (sourceId: string) => {
  const [examBlueprints, items] = await Promise.all([
    prisma.examBlueprint.findMany({
      orderBy: { name: "asc" },
      select: { country: true, id: true, language: true, name: true },
      where: { sourceId },
    }),
    prisma.item.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        format: true,
        id: true,
        language: true,
        skill: { select: { id: true, name: true } },
        sourceCitation: true,
      },
      take: MAX_SOURCE_CITATION_ROWS,
      where: { sourceId },
    }),
  ]);

  return { examBlueprints, items };
});

export async function listSourceCitations(sourceId: string) {
  return cachedListSourceCitations(sourceId);
}
