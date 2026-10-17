import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "../users/get-session";

/**
 * Reads the authenticated learner's committed watermark after a transport's writes, or before a
 * page's domain reads. This is deliberately uncached: two writes in one request can commit two
 * different revisions. The identity travels with the value so clients cannot apply another
 * learner's response after sign-out or account linking.
 */
export async function getLearnerRevision(): Promise<{ revision: string; userId: string } | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const learner = await prisma.user.findUnique({
    select: { learnerRevision: true },
    where: { id: session.user.id },
  });

  return learner ? { revision: String(learner.learnerRevision), userId: session.user.id } : null;
}
