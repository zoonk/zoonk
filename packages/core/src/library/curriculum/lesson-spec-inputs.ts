import "server-only";
import { type LessonSpecParams } from "@zoonk/ai/tasks/v2/lesson-spec";
import { prisma } from "@zoonk/db";
import { activityTemplates } from "../activities/activity-templates";
import { loadChapterLessons } from "../lessons/_utils/chapter-lessons";
import { loadLessonDocuments } from "../lessons/_utils/lesson-sources";
import { formatMaterialPages } from "../sources/material-pages";
import { type CurriculumScope } from "./curriculum-scope";

type SpecPrompt = Omit<LessonSpecParams, "analytics" | "model" | "reasoning" | "useFallback">;

export type LessonSpecInputs = {
  prompt: SpecPrompt;
  /** Where split lessons go: the lesson's home chapter, and who owns it. */
  homeChapterId: string | null;
  scope: CurriculumScope;
};

/** The activity templates a spec may plan, with when each helps, in catalog order. */
function listSpecActivityTemplates(): SpecPrompt["activityTemplates"] {
  return activityTemplates.map((template) => ({
    description: template.description,
    id: template.id,
  }));
}

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
      skills: { include: { skill: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
    omit: { spec: true, summary: true },
    where: { id: lessonId },
  });

  if (!lesson) {
    return null;
  }

  const chapter = lesson.homeChapter;
  const skills = lesson.skills.map((entry) => entry.skill.name);

  const [{ material, sources }, chapterLessons] = await Promise.all([
    loadLessonDocuments({
      chapterId: lesson.homeChapterId,
      courseId: chapter?.homeCourse?.id ?? null,
      lessonId,
      query: [lesson.title, lesson.description, lesson.canDo, ...skills].join(" "),
    }),
    loadChapterLessons({ chapterId: lesson.homeChapterId, lessonId, ownerId: lesson.ownerId }),
  ]);

  return {
    homeChapterId: lesson.homeChapterId,
    prompt: {
      activityTemplates: listSpecActivityTemplates(),
      chapterLessons,
      chapterTitle: chapter?.title ?? lesson.title,
      courseTitle: chapter?.homeCourse?.title ?? chapter?.title ?? lesson.title,
      language: lesson.language,
      lessonCanDo: lesson.canDo ?? undefined,
      lessonDescription: lesson.description,
      lessonTitle: lesson.title,
      level: lesson.level,
      material: material.length > 0 ? formatMaterialPages(material) : undefined,
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
