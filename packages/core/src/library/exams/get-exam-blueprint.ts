import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { canViewLibraryRow } from "../_utils/library-visibility";
import { readBlueprintContent } from "./save-exam-blueprint";

async function getCachedExamBlueprint(blueprintId: string) {
  "use cache";

  cacheTag(getExamBlueprintCacheTag(blueprintId));

  const blueprint = await prisma.examBlueprint.findUnique({
    include: {
      source: {
        select: {
          fetchedAt: true,
          id: true,
          kind: true,
          publisher: true,
          reusePolicy: true,
          title: true,
          url: true,
        },
      },
    },
    where: { id: blueprintId },
  });

  if (!blueprint) {
    return null;
  }

  return { ...blueprint, ...readBlueprintContent(blueprint) };
}

export async function getExamBlueprint({ blueprintId }: { blueprintId: string }) {
  if (!isUuid(blueprintId)) {
    return null;
  }

  const blueprint = await getCachedExamBlueprint(blueprintId);

  if (!blueprint || !(await canViewLibraryRow(blueprint))) {
    return null;
  }

  return blueprint;
}
