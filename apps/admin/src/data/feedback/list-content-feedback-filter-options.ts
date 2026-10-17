import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

function readDefinedValues(values: (string | null)[]): string[] {
  return values.filter((value): value is string => Boolean(value));
}

/**
 * Models and prompt versions change with every release, so the queue's selects list the values
 * votes actually stored instead of a fixed list.
 */
export const listContentFeedbackFilterOptions = cacheAdminData(async () => {
  const [models, promptVersions] = await Promise.all([
    prisma.contentFeedback.findMany({
      distinct: ["model"],
      orderBy: { model: "asc" },
      select: { model: true },
      where: { model: { not: null } },
    }),
    prisma.contentFeedback.findMany({
      distinct: ["promptVersion"],
      orderBy: { promptVersion: "asc" },
      select: { promptVersion: true },
      where: { promptVersion: { not: null } },
    }),
  ]);

  return {
    models: readDefinedValues(models.map((row) => row.model)),
    promptVersions: readDefinedValues(promptVersions.map((row) => row.promptVersion)),
  };
});
