import "server-only";
import { prisma } from "@zoonk/db";

/** Any generated content based on a private source must stay in that learner's key space. */
export async function hasPrivateSources(sourceIds: string[]): Promise<boolean> {
  const count = await prisma.source.count({
    where: { id: { in: sourceIds }, visibility: "private" },
  });

  return count > 0;
}
