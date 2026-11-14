import "server-only";
import { type ContentFixWhereInput, prisma } from "@zoonk/db";

/**
 * Ends the fixes in `where` that still wait for review, without changing any content, and drops
 * the approval challenge they held. Only a proposed fix changes, so a repeat, or a race with an
 * approval, ends each fix once. Returns how many it ended.
 */
export async function closeProposed({
  status,
  userId,
  where,
}: {
  status: "rejected" | "withdrawn";
  userId: string;
  where: ContentFixWhereInput;
}): Promise<number> {
  const { count } = await prisma.contentFix.updateMany({
    data: {
      approvalChallenge: null,
      approvalExpiresAt: null,
      decidedAt: new Date(),
      deciderId: userId,
      status,
    },
    where: { AND: [where, { status: "proposed" }] },
  });

  return count;
}
