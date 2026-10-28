import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { examEditionSchema } from "@zoonk/core/library/exams/blueprint-contract";
import { prisma } from "@zoonk/db";

function readEditionYear(edition: unknown): number | null {
  return examEditionSchema.safeParse(edition).data?.year ?? null;
}

/** A relation `_count` would count every exam's rows, not only the page's. */
async function countExamRows(examIds: string[]) {
  const [goals, items] = await Promise.all([
    prisma.goal.groupBy({
      _count: { id: true },
      by: ["examBlueprintId"],
      where: { examBlueprintId: { in: examIds }, ...trackedAnalyticsUserRelationWhere },
    }),
    prisma.item.groupBy({
      _count: { id: true },
      by: ["examBlueprintId"],
      where: { examBlueprintId: { in: examIds } },
    }),
  ]);

  const goalsByExam = new Map(goals.map((row) => [row.examBlueprintId, row._count.id]));
  const itemsByExam = new Map(items.map((row) => [row.examBlueprintId, row._count.id]));

  return (examId: string) => ({
    goals: goalsByExam.get(examId) ?? 0,
    items: itemsByExam.get(examId) ?? 0,
  });
}

const cachedListExams = cacheAdminData(async (limit: number, offset: number) => {
  const [exams, total] = await Promise.all([
    prisma.examBlueprint.findMany({
      omit: { structure: true, topicFrequency: true },
      orderBy: [{ name: "asc" }, { language: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit,
    }),
    prisma.examBlueprint.count(),
  ]);

  const counts = await countExamRows(exams.map((exam) => exam.id));

  return {
    exams: exams.map(({ edition, ...exam }) => ({
      ...exam,
      _count: counts(exam.id),
      editionYear: readEditionYear(edition),
    })),
    total,
  };
});

export type ListedExam = Awaited<ReturnType<typeof listExams>>["exams"][number];

export async function listExams({ limit, offset }: { limit: number; offset: number }) {
  return cachedListExams(limit, offset);
}
