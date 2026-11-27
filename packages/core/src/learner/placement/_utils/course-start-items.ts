import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";

export async function applyCourseStart({
  goalId,
  now,
  startedPastSkillIds,
  tx,
  exceptIds = [],
  lineSkillIds,
}: {
  goalId: string;
  now: Date;
  startedPastSkillIds: readonly string[];
  tx: TransactionClient;
  lineSkillIds?: readonly string[];
  exceptIds?: readonly string[];
}) {
  const ids = [...startedPastSkillIds];

  const started = new Set(ids);
  const kept = lineSkillIds?.filter((id) => !started.has(id));

  const items =
    ids.length > 0
      ? await tx.planItem.updateManyAndReturn({
          data: { completedAt: now, status: "testedOut" },
          select: {
            chapterId: true,
            id: true,
            kind: true,
            lessonId: true,
            lessons: true,
            skillId: true,
          },
          where: {
            kind: "lesson",
            plan: { goalId },
            status: "todo",
            ...(exceptIds.length > 0 && { id: { notIn: [...exceptIds] } }),
            AND: [
              { OR: [{ skillId: null }, { skillId: { in: ids } }] },
              {
                OR: [
                  { skillId: { in: ids } },
                  { lesson: { skills: { some: { skillId: { in: ids } } } } },
                ],
              },
              {
                OR: [
                  { lessonId: null },
                  ...(kept
                    ? [
                        {
                          lesson: { skills: { none: { skillId: { in: kept } } } },
                          skillId: { in: ids },
                        },
                      ]
                    : []),
                  { lesson: { skills: { every: { skillId: { in: ids } } } } },
                ],
              },
            ],
          },
        })
      : [];

  return {
    confirmed: new Set<string>(),
    heldUntilTomorrow: false,
    partLessonsSkipped: countLessons(items),
    sharedItemIds: [],
    testedOutPlanItemIds: items.map((item) => item.id),
  };
}
