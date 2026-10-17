import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getAdminAccess } from "../../users/get-admin-access";

type AdminFlagResult<T> =
  | (T & { status: "ready" })
  | { status: "forbidden" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/**
 * An admin decided a flagged lesson or question is still right after its source changed, so it
 * leaves the review queue. Dismissing it again changes nothing.
 */
export async function dismissReviewFlagForAdmin(flagId: string): Promise<AdminFlagResult<object>> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  if (!isUuid(flagId)) {
    return { status: "notFound" };
  }

  const flag = await prisma.contentReviewFlag.findUnique({ where: { id: flagId } });

  if (!flag) {
    return { status: "notFound" };
  }

  await prisma.contentReviewFlag.updateMany({
    data: { resolvedAt: new Date(), status: "dismissed" },
    where: { id: flagId, status: "open" },
  });

  return { status: "ready" };
}

/** The open flag an admin asked to rewrite now, for the API route that starts the rewrite. */
export async function getOpenReviewFlagForAdmin(
  flagId: string,
): Promise<AdminFlagResult<{ flagId: string }>> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  const flag = isUuid(flagId)
    ? await prisma.contentReviewFlag.findFirst({ where: { id: flagId, status: "open" } })
    : null;

  return flag ? { flagId: flag.id, status: "ready" } : { status: "notFound" };
}
