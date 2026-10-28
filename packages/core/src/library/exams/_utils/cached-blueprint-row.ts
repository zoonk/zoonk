import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../../cache/tags";

/** A blueprint row shared by the readers of this version. */
export async function getCachedBlueprintRow({
  blueprintId,
}: {
  blueprintId: string;
  version: number;
}) {
  "use cache";

  cacheTag(getExamBlueprintCacheTag(blueprintId));

  return prisma.examBlueprint.findUnique({ where: { id: blueprintId } });
}
