import "server-only";
import { prisma } from "@zoonk/db";
import { cacheLife, cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";

/**
 * One stored notice per request, for internal GET callers that already resolved an owned goal.
 * Public library reads retain their outside-cache visibility check in `getExamBlueprint`.
 */
export async function readExamBlueprint(blueprintId: string) {
  "use cache: private";

  cacheLife({ stale: Infinity });
  cacheTag(getExamBlueprintCacheTag(blueprintId));

  return prisma.examBlueprint.findUnique({ where: { id: blueprintId } });
}
