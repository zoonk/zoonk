import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { examEditionSchema } from "@zoonk/core/library/exams/blueprint-contract";
import { prisma } from "@zoonk/db";

/** The edition year is metadata inside the edition JSON; an unreadable edition has no year. */
function readEditionYear(edition: unknown): number | null {
  return examEditionSchema.safeParse(edition).data?.year ?? null;
}

const cachedListExams = cacheAdminData(async (limit: number, offset: number) => {
  const [exams, total] = await Promise.all([
    prisma.examBlueprint.findMany({
      include: {
        _count: { select: { goals: { where: trackedAnalyticsUserRelationWhere }, items: true } },
      },
      omit: { structure: true, topicFrequency: true },
      orderBy: [{ name: "asc" }, { language: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit,
    }),
    prisma.examBlueprint.count(),
  ]);

  return {
    exams: exams.map(({ edition, ...exam }) => ({
      ...exam,
      editionYear: readEditionYear(edition),
    })),
    total,
  };
});

export type ListedExam = Awaited<ReturnType<typeof listExams>>["exams"][number];

/**
 * Exam blueprints with their current edition and the dates the freshness checks
 * watch, plus how many goals and items depend on each.
 */
export async function listExams({ limit, offset }: { limit: number; offset: number }) {
  return cachedListExams(limit, offset);
}
