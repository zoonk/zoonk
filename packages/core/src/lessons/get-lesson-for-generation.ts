import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../users/get-session";

/**
 * Loads the AI-owned lesson that can be resumed by a generation workflow.
 * Malformed and inaccessible ids return `null` so every delivery app applies
 * the same generation boundary without exposing Prisma UUID parsing errors.
 */
export async function getLessonForGeneration(lessonId: string) {
  if (!isUuid(lessonId)) {
    return null;
  }

  const session = await getSession();

  return prisma.lesson.findFirst({
    include: { _count: { select: { steps: true } }, chapter: { include: { course: true } } },
    where: {
      chapter: {
        course: {
          OR: [
            { organization: { slug: AI_ORG_SLUG }, userId: null },
            ...(session ? [{ organizationId: null, userId: session.user.id }] : []),
          ],
        },
      },
      id: lessonId,
    },
  });
}
