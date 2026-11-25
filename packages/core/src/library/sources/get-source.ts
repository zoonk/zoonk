import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";
import { withSourceReadStatus } from "./source-read-status";

/** An upload merged into a shared copy reads as that copy, for its owner only. */
async function findMergedSource(sourceId: string) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const redirect = await prisma.sourceRedirect.findFirst({
    include: { to: true },
    where: { fromId: sourceId, userId: session.user.id },
  });

  return redirect ? withSourceReadStatus(redirect.to) : null;
}

export async function getSource({ sourceId }: { sourceId: string }) {
  if (!isUuid(sourceId)) {
    return null;
  }

  const source = await prisma.source.findUnique({ where: { id: sourceId } });

  if (!source) {
    return findMergedSource(sourceId);
  }

  if (source.visibility === "public") {
    return withSourceReadStatus(source);
  }

  const session = await getSession();

  return session?.user.id === source.ownerId ? withSourceReadStatus(source) : null;
}
