import "server-only";
import { prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { citedSourceSelect } from "../../library/sources/source-citation";
import { withLearnerVersionRows } from "../../library/variants/learner-versions";

/** What `toPlayableStep` reads: the step's image file and the learner's material or public source it cites. */
export const playableStepInclude = {
  mediaAsset: true,
  source: { select: { ...citedSourceSelect, kind: true, mimeType: true, visibility: true } },
};

/**
 * A lesson the learner may start: visible to them, with its content written. `planItems` is
 * non-empty only when the lesson answers one of the learner's own quick explanations.
 */
export function findStartableLesson({ lessonId, userId }: { lessonId: string; userId: string }) {
  return prisma.lesson.findFirst({
    select: {
      _count: { select: { steps: true } },
      homeChapterId: true,
      id: true,
      planItems: {
        select: { id: true },
        take: 1,
        where: { plan: { goal: { kind: "explain", userId } } },
      },
      title: true,
    },
    where: {
      contentStatus: "completed",
      id: lessonId,
      steps: { some: {} },
      ...libraryRowsVisibleTo(userId),
    },
  });
}

/**
 * A lesson the learner may play (visible to them, with its content written) and its screens as
 * they see them: a screen in their field or tool shows that version.
 */
export async function findPlayableLessonRow({
  lessonId,
  userId,
}: {
  lessonId: string;
  userId: string;
}) {
  const lesson = await prisma.lesson.findFirst({
    include: {
      skills: { select: { skillId: true } },
      steps: { include: playableStepInclude, orderBy: { position: "asc" } },
    },
    omit: { spec: true, summary: true },
    where: { contentStatus: "completed", id: lessonId, ...libraryRowsVisibleTo(userId) },
  });

  return lesson
    ? { ...lesson, steps: await withLearnerVersionRows({ lessonId, rows: lesson.steps, userId }) }
    : null;
}

/**
 * One screen of a lesson the learner may play, as they see it, with what grading it needs from
 * its lesson.
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
          skills: { select: { skillId: true } },
          targetLanguage: true,
        },
      },
    },
    where: { id: stepId, lesson: { contentStatus: "completed", ...libraryRowsVisibleTo(userId) } },
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
