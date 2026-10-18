import "server-only";
import { prisma } from "@zoonk/db";

/** Capture before domain reads, so delayed delivery cannot claim a newer viewer revision. */
export async function loadViewerStamp(userId: string) {
  const viewer = await prisma.user.findUniqueOrThrow({
    select: { learnerRevision: true },
    where: { id: userId },
  });

  return { revision: String(viewer.learnerRevision), userId };
}
