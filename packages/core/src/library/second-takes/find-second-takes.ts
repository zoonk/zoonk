import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { CURRENT_STEPS } from "../lessons/lesson-versions";
import { SECOND_TAKE_KEY_WHERE, getSecondTakeSkillId } from "./second-take-identity";

type SecondTakeRef = { estimatedMinutes: number; lessonId: string; title: string };

/** Internal day builder read. Entitlement is decided with the rest of the day's work. */
export async function findSecondTakes({
  db = prisma,
  skillIds,
  userId,
}: {
  db?: TransactionClient;
  skillIds: readonly string[];
  userId: string;
}): Promise<Map<string, SecondTakeRef>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const lessons = await db.lesson.findMany({
    select: { estimatedMinutes: true, id: true, identityKey: true, title: true },
    where: {
      ...libraryRowsVisibleTo(userId),
      AND: SECOND_TAKE_KEY_WHERE,
      contentStatus: "completed",
      setAsideAt: null,
      skills: { some: { skillId: { in: [...skillIds] } } },
      steps: { some: CURRENT_STEPS },
    },
  });

  const wanted = new Set(skillIds);

  return new Map(
    lessons.flatMap(({ estimatedMinutes, id, identityKey, title }) => {
      const skillId = getSecondTakeSkillId(identityKey);

      return skillId && wanted.has(skillId)
        ? [[skillId, { estimatedMinutes, lessonId: id, title }] as const]
        : [];
    }),
  );
}
