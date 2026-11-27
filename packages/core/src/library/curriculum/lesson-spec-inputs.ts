import "server-only";
import { type LessonSpecParams } from "@zoonk/ai/tasks/lesson-spec";
import { prisma } from "@zoonk/db";
import { isSetupSkillIdentityKey } from "@zoonk/utils/identity-key";
import { listPlannerTemplates } from "../activities/writer-templates";
import { getLessonCountry } from "../content-country";
import { loadChapterLessons } from "../lessons/_utils/chapter-lessons";
import { loadLessonExams, loadLessonShortAnswers } from "../lessons/_utils/lesson-exams";
import { loadLessonDocuments } from "../lessons/_utils/lesson-sources";
import { COURSE_PRODUCT_SELECT, toPromptProduct } from "../products/course-product";
import {
  getSiblingsChapterId,
  isQuickLessonIdentityKey,
} from "../quick-lessons/quick-lesson-identity";
import { getSecondTakeSkillId } from "../second-takes/second-take-identity";
import { findSecondTakeSource } from "../second-takes/second-take-source";
import { loadSecondTakeWrongAnswers } from "../second-takes/second-take-wrong-answers";
import { formatMaterialPages } from "../sources/material-pages";
import { type CurriculumScope } from "./curriculum-scope";

type SpecPrompt = Omit<LessonSpecParams, "analytics" | "model" | "reasoning" | "useFallback">;

export type LessonSpecInputs = {
  prompt: SpecPrompt;
  homeChapterId: string | null;
  scope: CurriculumScope;
};

async function loadSecondTakeSpecInputs({
  lesson,
  skill,
  skillId,
}: {
  lesson: { language: string; ownerId: string | null; targetLanguage: string | null };
  skill: { country: string | null; name: string };
  skillId: string;
}): Promise<LessonSpecInputs | null> {
  const { language, ownerId, targetLanguage } = lesson;

  const source = await findSecondTakeSource({ language, ownerId, skillId });

  if (!source) {
    return null;
  }

  const chapter = source.homeChapter;
  const country = getLessonCountry({ course: chapter?.homeCourse, skill });
  const wrongAnswers = await loadSecondTakeWrongAnswers({ lessonId: source.id, skillId });

  return {
    homeChapterId: null,
    prompt: {
      activityTemplates: listPlannerTemplates(),
      chapterTitle: chapter?.title ?? source.title,
      country,
      courseTitle: chapter?.homeCourse?.title ?? chapter?.title ?? source.title,
      isPrivate: ownerId !== null,
      language,
      lessonCanDo: source.canDo ?? undefined,
      lessonDescription: source.description,
      lessonTitle: source.title,
      level: source.level,
      secondTake: { firstLessonMap: source.map, wrongAnswers },
      skills: [skill.name],
    },
    scope: { country, generalGoal: null, language, ownerId, targetLanguage },
  };
}

function readLessonForSpec(lessonId: string) {
  return prisma.lesson.findUnique({
    include: {
      homeChapter: {
        include: {
          homeCourse: {
            select: { ...COURSE_PRODUCT_SELECT, country: true, id: true, title: true },
          },
        },
      },
      skills: {
        include: { skill: { select: { country: true, identityKey: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    omit: { spec: true, summary: true },
    where: { id: lessonId },
  });
}

type LessonForSpec = NonNullable<Awaited<ReturnType<typeof readLessonForSpec>>>;

function readSecondTakeSpec(lesson: LessonForSpec, skillId: string) {
  const skill = lesson.skills.find((link) => link.skillId === skillId)?.skill;
  return skill ? loadSecondTakeSpecInputs({ lesson, skill, skillId }) : null;
}

export async function loadLessonSpecInputs(lessonId: string): Promise<LessonSpecInputs | null> {
  const lesson = await readLessonForSpec(lessonId);

  if (!lesson) {
    return null;
  }

  const secondTakeSkillId = getSecondTakeSkillId(lesson.identityKey);

  if (secondTakeSkillId) {
    const inputs = await readSecondTakeSpec(lesson, secondTakeSkillId);

    if (inputs) {
      return inputs;
    }

    // A merge can move the source between reads. Missing inputs would set the lesson aside.
    const moved = await readLessonForSpec(lessonId);
    const movedSkillId = moved && getSecondTakeSkillId(moved.identityKey);

    return moved && movedSkillId && movedSkillId !== secondTakeSkillId
      ? readSecondTakeSpec(moved, movedSkillId)
      : null;
  }

  return loadOrdinarySpecInputs(lesson);
}

async function loadOrdinarySpecInputs(lesson: LessonForSpec): Promise<LessonSpecInputs> {
  const lessonId = lesson.id;
  const chapter = lesson.homeChapter;
  const country = getLessonCountry({ course: chapter?.homeCourse, skill: lesson.skills[0]?.skill });
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
      country,
      courseTitle: chapter?.homeCourse?.title ?? chapter?.title ?? lesson.title,
      exams: material.length > 0 ? [] : exams,
      isPrivate: lesson.visibility === "private",
      language: lesson.language,
      lessonCanDo: lesson.canDo ?? undefined,
      lessonDescription: lesson.description,
      lessonTitle: lesson.title,
      level: lesson.level,
      material: material.length > 0 ? formatMaterialPages(material) : undefined,
      product: chapter?.homeCourse ? toPromptProduct(chapter.homeCourse) : null,
      quick: isQuickLessonIdentityKey(lesson.identityKey),
      setup: lesson.skills.some(({ skill }) => isSetupSkillIdentityKey(skill.identityKey)),
      shortAnswers,
      skills,
      sources: sources.length > 0 ? formatMaterialPages(sources) : undefined,
    },
    scope: {
      country,
      generalGoal: null,
      language: lesson.language,
      ownerId: lesson.ownerId,
      targetLanguage: lesson.targetLanguage,
    },
  };
}
