import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";

/**
 * Reads one source for citations and the learner's material. Public sources
 * are readable by anyone; a private upload only by its owner, and anyone else
 * gets null as if it didn't exist. Freshness and visibility change in the
 * background, so this read is not cached.
 */
export async function getSource({ sourceId }: { sourceId: string }) {
  if (!isUuid(sourceId)) {
    return null;
  }

  const source = await prisma.source.findUnique({
    omit: { extractedText: true },
    where: { id: sourceId },
  });

  if (!source || source.visibility === "public") {
    return source;
  }

  const session = await getSession();

  return session?.user.id === source.ownerId ? source : null;
}
