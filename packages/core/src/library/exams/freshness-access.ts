import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getAdminAccess } from "../../users/get-admin-access";
import { type FreshnessTarget } from "./check-freshness";

export type FreshnessCommandAccess =
  | { status: "unauthorized" }
  | { status: "forbidden" }
  | { status: "notFound" }
  | { status: "ready"; target: FreshnessTarget };

async function findTarget(target: FreshnessTarget): Promise<FreshnessTarget | null> {
  if (target.kind === "exam") {
    // Prisma batches `findUnique` calls made together and matches rows back by exact id, so a
    // capitalized id finds nothing while the lowercase one is looked up at the same time.
    const exam = await prisma.examBlueprint.findFirst({
      select: { id: true },
      where: { id: target.examBlueprintId },
    });

    return exam ? { examBlueprintId: exam.id, kind: "exam" } : null;
  }

  const source = await prisma.source.findFirst({
    select: { id: true },
    where: { id: target.sourceId, url: { not: null } },
  });

  return source ? { kind: "source", sourceId: source.id } : null;
}

function getTargetId(target: FreshnessTarget): string {
  return target.kind === "exam" ? target.examBlueprintId : target.sourceId;
}

/**
 * A ready `target` carries the stored ids, so a run key built from it matches however the request
 * capitalized them.
 */
export async function getFreshnessCommandAccess(
  target: FreshnessTarget,
): Promise<FreshnessCommandAccess> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  const stored = isUuid(getTargetId(target)) ? await findTarget(target) : null;
  return stored ? { status: "ready", target: stored } : { status: "notFound" };
}
