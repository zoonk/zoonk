import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import {
  CHALLENGE_KEY_PREFIX,
  isChallengeIdentityKey,
} from "../../library/challenges/challenge-lesson-spec";

export async function loadWindowChallenges({
  goalId,
  lessonIds,
  userId,
}: {
  goalId: string;
  lessonIds: string[];
  userId: string;
}): Promise<string[]> {
  if (lessonIds.length === 0) {
    return [];
  }

  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    select: { lesson: { select: { id: true, identityKey: true } } },
    where: {
      kind: "lesson",
      lesson: {
        ...libraryRowsVisibleTo(userId),
        homeChapter: { homeLessons: { some: { id: { in: lessonIds } } } },
        identityKey: { contains: CHALLENGE_KEY_PREFIX },
        setAsideAt: null,
      },
      plan: { goalId },
      status: "todo",
    },
  });

  return items.flatMap(({ lesson }) =>
    lesson && isChallengeIdentityKey(lesson.identityKey) ? [lesson.id] : [],
  );
}
