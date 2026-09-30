import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Whether research reads a learner's private material, in which case what it
 * builds stays in that learner's key space and is never shared.
 */
export async function hasPrivateSources(sourceIds: string[]): Promise<boolean> {
  const count = await prisma.source.count({
    where: { id: { in: sourceIds }, visibility: "private" },
  });

  return count > 0;
}
