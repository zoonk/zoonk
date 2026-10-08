import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getAdminAccess } from "../../users/get-admin-access";
import { type FreshnessTarget } from "./check-freshness";

export type FreshnessCommandAccess = "unauthorized" | "forbidden" | "notFound" | "ready";

async function targetExists(target: FreshnessTarget): Promise<boolean> {
  if (target.kind === "exam") {
    const count = await prisma.examBlueprint.count({ where: { id: target.examBlueprintId } });
    return count > 0;
  }

  const count = await prisma.source.count({ where: { id: target.sourceId, url: { not: null } } });
  return count > 0;
}

function getTargetId(target: FreshnessTarget): string {
  return target.kind === "exam" ? target.examBlueprintId : target.sourceId;
}

/**
 * Only admins may check an exam or source now or stop its checks: a check costs
 * a fetch, and a change can cost a model run.
 */
export async function getFreshnessCommandAccess(
  target: FreshnessTarget,
): Promise<FreshnessCommandAccess> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return access;
  }

  if (!isUuid(getTargetId(target)) || !(await targetExists(target))) {
    return "notFound";
  }

  return "ready";
}
