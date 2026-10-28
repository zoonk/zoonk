import "server-only";
import { type LessonSpecParams } from "@zoonk/ai/tasks/v2/lesson-spec";
import { prisma } from "@zoonk/db";
import { isSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { listPlannerTemplates } from "../activities/writer-templates";
import { loadChapterLessons } from "../lessons/_utils/chapter-lessons";
import { loadLessonExams, loadLessonShortAnswers } from "../lessons/_utils/lesson-exams";
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
  homeChapterId: string | null;
  scope: CurriculumScope;
};

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

  const [{ material, sources }, chapterLessons, exams, shortAnswers] = await Promise.all([
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
    loadLessonShortAnswers(goalsOf),
  ]);

  return {
    homeChapterId: lesson.homeChapterId,
    prompt: {
      activityTemplates: listPlannerTemplates(),
      chapterLessons,
      chapterTitle: chapter?.title ?? lesson.title,
      courseTitle: chapter?.homeCourse?.title ?? chapter?.title ?? lesson.title,
      exams: material.length > 0 ? [] : exams,
      language: lesson.language,
      lessonCanDo: lesson.canDo ?? undefined,
      lessonDescription: lesson.description,
      lessonTitle: lesson.title,
      level: lesson.level,
      material: material.length > 0 ? formatMaterialPages(material) : undefined,
      quick: isQuickLessonIdentityKey(lesson.identityKey),
      setup: lesson.skills.some(({ skill }) => isSetupSkillIdentityKey(skill.identityKey)),
      shortAnswers,
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
