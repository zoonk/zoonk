import "server-only";
import { type Course, prisma } from "@zoonk/db";
import {
  type MaterialPage,
  type MaterialSource,
  formatMaterialOverview,
  selectMaterialPages,
  toMaterialPages,
} from "./material-pages";

/** A goal is built from at most this many of the learner's files, in the order they added them. */
const MAX_MATERIAL_SOURCES = 5;

/**
 * The learner's own material behind a goal: files and texts they uploaded that stayed private
 * (class slides, notes). Public documents they uploaded, such as an exam notice, are the goal's
 * syllabus, not teaching material, so they're left out.
 */
async function findMaterial(goalIds: readonly string[]): Promise<MaterialSource[]> {
  if (goalIds.length === 0) {
    return [];
  }

  const links = await prisma.learnerSource.findMany({
    orderBy: { createdAt: "asc" },
    select: { source: { select: { extractedText: true, id: true, mimeType: true, title: true } } },
    take: MAX_MATERIAL_SOURCES,
    where: {
      goalId: { in: [...goalIds] },
      origin: "upload",
      source: { extractedText: { not: null }, kind: "upload", visibility: "private" },
    },
  });

  return links.flatMap(({ source }) =>
    source.extractedText ? [{ ...source, text: source.extractedText }] : [],
  );
}

/**
 * The material a goal is built from. A goal with material gets a private course: its lessons
 * teach from the learner's own files and cite their pages.
 *
 * This is a workflow bridge: the goal id comes from the public boundary that created the goal.
 */
export function loadGoalMaterial(goalId: string): Promise<MaterialSource[]> {
  return findMaterial([goalId]);
}

/** A course outline reads a short handout whole, or the index of a long deck. */
const MAX_COURSE_MATERIAL = 12_000;

/**
 * The material a private course is built from, as its outline reads it: the uploads of its owner's
 * goals whose own course it is, whole when short (a teacher's summary), else one line per page.
 * Null for shared courses and courses without material, whose outlines cover their whole band.
 *
 * This is a workflow bridge: the course comes from the outline run that holds its claim.
 */
export async function loadCourseMaterial(
  course: Pick<Course, "id" | "userId" | "visibility">,
): Promise<string | null> {
  if (!course.userId || course.visibility !== "private") {
    return null;
  }

  const goals = await prisma.goal.findMany({
    select: { id: true },
    where: { primaryCourseId: course.id, userId: course.userId },
  });

  const pages = toMaterialPages(await findMaterial(goals.map((goal) => goal.id)));

  return pages.length > 0
    ? formatMaterialOverview({ maxCharacters: MAX_COURSE_MATERIAL, pages })
    : null;
}

/**
 * The goals a lesson is written for: those whose plan has the lesson or its chapter, or whose own
 * course is the lesson's course. A Prisma goal filter, to use inside other queries.
 */
export function lessonGoalsFilter({
  chapterId,
  courseId,
  lessonId,
}: {
  chapterId: string | null;
  courseId: string | null;
  lessonId: string;
}) {
  return {
    OR: [
      { plan: { items: { some: { lessonId } } } },
      ...(chapterId ? [{ plan: { items: { some: { chapterId } } } }] : []),
      ...(courseId ? [{ primaryCourseId: courseId }] : []),
    ],
  };
}

/**
 * The material a private lesson is written from: the uploads of its owner's goal that plans the
 * lesson, its chapter or its course. Shared lessons never read anyone's material.
 *
 * This is a workflow bridge: the lesson id comes from the workflow that holds its claim.
 */
async function loadLessonMaterial(lessonId: string): Promise<MaterialSource[]> {
  const lesson = await prisma.lesson.findUnique({
    select: { homeChapter: { select: { homeCourseId: true } }, homeChapterId: true, ownerId: true },
    where: { id: lessonId },
  });

  if (!lesson?.ownerId) {
    return [];
  }

  const goals = await prisma.goal.findMany({
    select: { id: true },
    where: {
      ...lessonGoalsFilter({
        chapterId: lesson.homeChapterId,
        courseId: lesson.homeChapter?.homeCourseId ?? null,
        lessonId,
      }),
      userId: lesson.ownerId,
    },
  });

  return findMaterial(goals.map((goal) => goal.id));
}

/**
 * The pages of its owner's material one private lesson is written from: those closest to what it
 * teaches (`query`: its title, description and skills). Empty for shared lessons and for goals
 * without material.
 */
export async function loadLessonMaterialPages({
  lessonId,
  query,
}: {
  lessonId: string;
  query: string;
}): Promise<MaterialPage[]> {
  const material = await loadLessonMaterial(lessonId);
  return selectMaterialPages({ pages: toMaterialPages(material), query });
}
