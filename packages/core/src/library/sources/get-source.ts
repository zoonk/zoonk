import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";

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
