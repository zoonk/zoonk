import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { getCachedBlueprintRow } from "./_utils/cached-blueprint-row";

/**
 * An exam's blueprint row, the same for every learner of the exam, so it's cached once for all of
 * them. A fresh version read prevents an API workflow's update from serving the previous exam
 * dates or structure in Main, whose cache the API cannot expire. For internal GET callers that
 * already resolved an owned goal; public library reads keep their visibility check in
 * `getExamBlueprint`.
 */
export async function readExamBlueprint(blueprintId: string) {
  "use cache: private";

  cacheTag(getExamBlueprintCacheTag(blueprintId));

  const version = await prisma.examBlueprint.findUnique({
    select: { updatedAt: true },
    where: { id: blueprintId },
  });

  return version
    ? getCachedBlueprintRow({ blueprintId, version: version.updatedAt.getTime() })
    : null;
}
