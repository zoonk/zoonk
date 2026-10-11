import "server-only";
import { type LessonSpecParams } from "@zoonk/ai/tasks/v2/lesson-spec";
import { prisma } from "@zoonk/db";
import { isSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { listPlannerTemplates } from "../activities/writer-templates";
import { loadChapterLessons } from "../lessons/_utils/chapter-lessons";
import { loadLessonExams } from "../lessons/_utils/lesson-exams";
import { loadLessonDocuments } from "../lessons/_utils/lesson-sources";
import {
  getSiblingsChapterId,
  isQuickLessonIdentityKey,
} from "../quick-lessons/quick-lesson-identity";
import { formatMaterialPages } from "../sources/material-pages";
import { type CurriculumScope } from "./curriculum-scope";

type SpecPrompt = Omit<LessonSpecParams, "analytics" | "model" | "reasoning" | "useFallback">;

export type LessonSpecInputs = {
  prompt: SpecPrompt;
  /** Where split lessons go: the lesson's home chapter, and who owns it. */
  homeChapterId: string | null;
  scope: CurriculumScope;
};

/**
 * Loads what planning one lesson needs: its outline (title, description, can-do line and skills),
 * where it sits (course, chapter and what the chapter's other lessons teach and use so far, so it
 * stays in its own scope and adds something new), who owns it and, for a private lesson built
 * from the learner's material, the pages it teaches from, or for a lesson of a goal built from
 * sources, the passages its facts come from. Null when the lesson no longer exists.
 */
export async function loadLessonSpecInputs(lessonId: string): Promise<LessonSpecInputs | null> {
  const lesson = await prisma.lesson.findUnique({
    include: {
      homeChapter: { include: { homeCourse: { select: { id: true, title: true } } } },
      skills: {
        include: { skill: { select: { identityKey: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    omit: { spec: true, summary: true },
    where: { id: lessonId },
  });

  if (!lesson) {
    return null;
  }

  const chapter = lesson.homeChapter;
  const skills = lesson.skills.map((entry) => entry.skill.name);

  const goalsOf = {
    chapterId: lesson.homeChapterId,
    courseId: chapter?.homeCourse?.id ?? null,
    lessonId,
  };

  const [{ material, sources }, chapterLessons, exams] = await Promise.all([
    loadLessonDocuments({
      ...goalsOf,
      query: [lesson.title, lesson.description, lesson.canDo, ...skills].join(" "),
    }),
    loadChapterLessons({
      chapterId: getSiblingsChapterId(lesson),
      lessonId,
      ownerId: lesson.ownerId,
    }),
    loadLessonExams(goalsOf),
  ]);

  return {
    homeChapterId: lesson.homeChapterId,
    prompt: {
      activityTemplates: listPlannerTemplates(),
      chapterLessons,
      chapterTitle: chapter?.title ?? lesson.title,
      courseTitle: chapter?.homeCourse?.title ?? chapter?.title ?? lesson.title,
      // A lesson built from the learner's own material follows that material, not an exam's style.
      exams: material.length > 0 ? [] : exams,
      language: lesson.language,
      lessonCanDo: lesson.canDo ?? undefined,
      lessonDescription: lesson.description,
      lessonTitle: lesson.title,
      level: lesson.level,
      material: material.length > 0 ? formatMaterialPages(material) : undefined,
      quick: isQuickLessonIdentityKey(lesson.identityKey),
      setup: lesson.skills.some(({ skill }) => isSetupSkillIdentityKey(skill.identityKey)),
      skills,
      sources: sources.length > 0 ? formatMaterialPages(sources) : undefined,
    },
    scope: {
      generalGoal: null,
      language: lesson.language,
      ownerId: lesson.ownerId,
      targetLanguage: lesson.targetLanguage,
    },
  };
}
