import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import { getUserProgressCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";

export async function getFinishedLessonStudyBlock({
  blockId,
  lessonId,
  sessionId,
}: {
  blockId?: string;
  lessonId: string;
  sessionId: string | null;
}): Promise<string | null> {
  "use cache: private";

  if (
    !sessionId ||
    !isUuid(sessionId) ||
    !isUuid(lessonId) ||
    (blockId !== undefined && !isUuid(blockId))
  ) {
    return null;
  }

  const actor = await getSession();

  if (!actor) {
    return null;
  }

  cacheTag(getUserProgressCacheTag(actor.user.id));

  const block = await prisma.studySessionBlock.findFirst({
    orderBy: { position: "asc" },
    select: { id: true },
    where: {
      ...(blockId && { id: blockId }),
      kind: "learn",
      lessonId,
      session: { userId: actor.user.id },
      sessionId,
      status: "completed",
    },
  });

  return block?.id ?? null;
}
