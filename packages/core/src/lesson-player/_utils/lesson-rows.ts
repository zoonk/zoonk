import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { citedSourceSelect } from "../../library/sources/source-citation";
import { withLearnerVersionRows } from "../../library/variants/learner-versions";

export const playableStepInclude = {
  mediaAsset: true,
  optionPictures: { include: { mediaAsset: true } },
  source: { select: { ...citedSourceSelect, kind: true, mimeType: true, visibility: true } },
};

function ownExplanationItems(userId: string) {
  return {
    select: { id: true },
    take: 1,
    where: { plan: { goal: { kind: "explain" as const, userId } } },
  };
}

export function isOwnExplanation(lesson: { planItems: readonly unknown[] }): boolean {
  return lesson.planItems.length > 0;
}

export function findStartableLesson({ lessonId, userId }: { lessonId: string; userId: string }) {
  return prisma.lesson.findFirst({
    select: {
      _count: { select: { steps: { where: CURRENT_STEPS } } },
      homeChapterId: true,
      id: true,
      planItems: ownExplanationItems(userId),
      title: true,
    },
    where: {
      contentStatus: "completed",
      id: lessonId,
      steps: { some: CURRENT_STEPS },
      ...libraryRowsVisibleTo(userId),
    },
  });
}

/** An explicit version serves its original screens even after replacement; null uses the current published version. */
export async function findPlayableLessonRow({
  lessonId,
  userId,
  version = null,
}: {
  lessonId: string;
  userId: string;
  version?: number | null;
}) {
  const lesson = await prisma.lesson.findFirst({
    include: {
      planItems: ownExplanationItems(userId),
      skills: { select: { skillId: true } },
      steps: {
        include: playableStepInclude,
        orderBy: { position: "asc" },
        where: version === null ? CURRENT_STEPS : { version },
      },
    },
    omit: { spec: true, summary: true },
    where: {
      id: lessonId,
      ...(version === null && { contentStatus: "completed" }),
      ...libraryRowsVisibleTo(userId),
    },
  });

  return lesson
    ? { ...lesson, steps: await withLearnerVersionRows({ lessonId, rows: lesson.steps, userId }) }
    : null;
}

/** Completed runs must bound answers with until; otherwise a later run can select the wrong version. */
export async function findOpenedVersion({
  lessonId,
  since,
  stepIds = [],
  until,
  userId,
}: {
  lessonId: string;
  since?: Date;
  stepIds?: readonly string[];
  until?: Date;
  userId: string;
}): Promise<number | null> {
  const opened =
    stepIds.length > 0
      ? await prisma.step.findFirst({
          select: { version: true },
          where: { id: { in: [...stepIds] }, lessonId },
        })
      : await prisma.attempt
          .findFirst({
            orderBy: { answeredAt: "desc" },
            select: { step: { select: { version: true } } },
            where: { answeredAt: { gte: since, lte: until }, step: { lessonId }, userId },
          })
          .then((attempt) => attempt?.step ?? null);

  return opened?.version ?? null;
}

/** Includes replaced screens for already-open runs; recording still requires an open run of a published lesson. */
export async function findPlayableStepRow({ stepId, userId }: { stepId: string; userId: string }) {
  const row = await prisma.step.findFirst({
    include: {
      ...playableStepInclude,
      lesson: {
        select: {
          id: true,
          language: true,
          level: true,
          planItems: ownExplanationItems(userId),
          skills: {
            orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
            select: { skillId: true },
          },
          targetLanguage: true,
        },
      },
    },
    where: { id: stepId, lesson: libraryRowsVisibleTo(userId) },
  });

  if (!row) {
    return null;
  }

  const [seen] = await withLearnerVersionRows({ lessonId: row.lessonId, rows: [row], userId });
  return seen ?? row;
}

/** Untagged screens train the lesson's first skill, so misses remain schedulable in the notebook. */
export function getAnswerSkillId({
  lessonSkillIds,
  stepSkillId,
}: {
  lessonSkillIds: string[];
  stepSkillId: string | null;
}): string | null {
  return stepSkillId ?? lessonSkillIds[0] ?? null;
}
