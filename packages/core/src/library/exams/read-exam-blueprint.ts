import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";

/**
 * An exam's blueprint row, the same for every learner of the exam, so it's cached once for all of
 * them until a new notice changes it (another app's change shows on the default revalidation, as
 * the exam map's does). For internal GET callers that already resolved an owned goal; public
 * library reads keep their visibility check in `getExamBlueprint`.
 */
export async function readExamBlueprint(blueprintId: string) {
  "use cache";

  cacheTag(getExamBlueprintCacheTag(blueprintId));

  return prisma.examBlueprint.findUnique({ where: { id: blueprintId } });
}
