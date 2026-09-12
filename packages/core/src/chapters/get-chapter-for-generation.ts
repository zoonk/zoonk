import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";

/**
 * Loads the AI-owned chapter that can be resumed by a generation workflow.
 * Malformed and inaccessible ids return `null` so every delivery app applies
 * the same generation boundary without exposing Prisma UUID parsing errors.
 */
export async function getChapterForGeneration(chapterId: string) {
  if (!isUuid(chapterId)) {
    return null;
  }

  const session = await getSession();

  return prisma.chapter.findFirst({
    include: { _count: { select: { lessons: true } }, course: true },
    where: {
      course: {
        OR: [
          { organization: { slug: AI_ORG_SLUG }, userId: null },
          ...(session ? [{ organizationId: null, userId: session.user.id }] : []),
        ],
      },
      id: chapterId,
    },
  });
}
