import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { LEARN_KINDS } from "../../../plans/planner/plan-item-rules";

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
            phase: true,
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

  const phases = [...new Set(items.map((item) => item.phase))];

  const checkpoints =
    phases.length > 0 ? await skipClosedPhaseChallenges({ goalId, now, phases, tx }) : [];

  return {
    confirmed: new Set<string>(),
    heldUntilTomorrow: false,
    partLessonsSkipped: countLessons(items),
    sharedItemIds: [],
    testedOutPlanItemIds: [...items, ...checkpoints].map((item) => item.id),
  };
}

async function skipClosedPhaseChallenges({
  goalId,
  now,
  phases,
  tx,
}: {
  goalId: string;
  now: Date;
  phases: number[];
  tx: TransactionClient;
}) {
  const remaining = await tx.planItem.groupBy({
    by: ["phase"],
    where: { kind: { in: [...LEARN_KINDS] }, plan: { goalId }, status: "todo" },
  });

  const open = new Set(remaining.map((item) => item.phase));

  return tx.planItem.updateManyAndReturn({
    data: { completedAt: now, status: "testedOut" },
    select: { id: true },
    where: {
      kind: "boss",
      ...(open.size > 0 && {
        OR: [
          { phase: { lt: Math.min(...open) } },
          { phase: { in: phases.filter((phase) => !open.has(phase)) } },
        ],
      }),
      plan: { goalId },
      status: "todo",
    },
  });
}
