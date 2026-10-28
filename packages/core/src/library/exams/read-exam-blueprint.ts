import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { getCachedBlueprintRow } from "./_utils/cached-blueprint-row";

/** Internal GET callers must already have resolved an owned goal; public reads use `getExamBlueprint` for visibility. */
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
