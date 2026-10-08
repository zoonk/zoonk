import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { CURRENT_STEPS } from "../../library/lessons/lesson-versions";
import { citedSourceSelect } from "../../library/sources/source-citation";
import { withLearnerVersionRows } from "../../library/variants/learner-versions";

/** What `toPlayableStep` reads: the step's image file and the learner's material or public source it cites. */
export const playableStepInclude = {
  mediaAsset: true,
  source: { select: { ...citedSourceSelect, kind: true, mimeType: true, visibility: true } },
};

/**
 * The plan item of the learner's own quick explanation a lesson answers, if it answers one. A
 * lesson read with it has `planItems` non-empty only then (see `isOwnExplanation`).
 */
function ownExplanationItems(userId: string) {
  return {
    select: { id: true },
    take: 1,
    where: { plan: { goal: { kind: "explain" as const, userId } } },
  };
}

/** Whether a lesson read with `ownExplanationItems` answers one of the learner's quick explanations. */
export function isOwnExplanation(lesson: { planItems: readonly unknown[] }): boolean {
  return lesson.planItems.length > 0;
}

/** A lesson the learner may start: visible to them, with its content written. */
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

/**
 * A lesson the learner may play and its screens as they see them: a screen in their field or tool
 * shows that version. Without `version`, the lesson as it opens now (published, its current
 * screens). With a `version` the learner opened before a check published a fix (see
 * `findOpenedVersion`), that version's screens, whether or not it's still the current one.
 */
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

/**
 * The version of a lesson the learner is playing: a check can publish a fixed version while they
 * play (or take the lesson out of play), and they finish the one they opened. It's the version of
 * the screens they name (`stepIds`), or else of their latest answer to the lesson since `since`.
 * Null when they haven't answered yet: they play the lesson as it opens now.
 */
export async function findOpenedVersion({
  lessonId,
  since,
  stepIds = [],
  userId,
}: {
  lessonId: string;
  since?: Date;
  stepIds?: readonly string[];
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
            where: { answeredAt: { gte: since }, step: { lessonId }, userId },
          })
          .then((attempt) => attempt?.step ?? null);

  return opened?.version ?? null;
}

/**
 * One screen of a lesson the learner may see, as they see it, with what grading it needs from its
 * lesson. A screen of a version replaced since the learner opened it (a check published a fix, or
 * the lesson was taken out of play to be written again) is still found: they finish the version
 * they opened. Answers still need an open run, which only starts on a published lesson.
 */
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
          skills: { select: { skillId: true } },
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

/**
 * The skill an answer trains: the screen's own skill, or the lesson's when it teaches just one, so
 * a check the writer didn't tag still reaches the learner's memory.
 */
export function getAnswerSkillId({
  lessonSkillIds,
  stepSkillId,
}: {
  lessonSkillIds: string[];
  stepSkillId: string | null;
}): string | null {
  if (stepSkillId) {
    return stepSkillId;
  }

  return lessonSkillIds.length === 1 ? (lessonSkillIds[0] ?? null) : null;
}
