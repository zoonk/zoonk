import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";

export type DismissMistakePatternResult = { status: "dismissed" | "notFound" | "unauthorized" };

/**
 * Takes a pattern off Today without practicing it, such as a note that the mistakes were only
 * typos, which has nothing to drill. Dismissing it again changes nothing.
 */
export async function dismissMistakePattern(
  patternId: string,
): Promise<DismissMistakePatternResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (!isUuid(patternId)) {
    return { status: "notFound" };
  }

  const pattern = await prisma.mistakePattern.findFirst({
    select: { dismissedAt: true, id: true },
    where: { id: patternId, userId },
  });

  if (!pattern) {
    return { status: "notFound" };
  }

  if (!pattern.dismissedAt) {
    await prisma.mistakePattern.update({
      data: { dismissedAt: new Date() },
      where: { id: pattern.id },
    });

    revalidateCacheTags([getUserProgressCacheTag(userId)]);
  }

  return { status: "dismissed" };
}
