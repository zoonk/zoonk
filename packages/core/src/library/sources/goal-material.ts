import "server-only";
import { type Course, prisma } from "@zoonk/db";
import {
  type MaterialPage,
  type MaterialSource,
  formatMaterialOverview,
  selectMaterialPages,
  toMaterialPages,
} from "./material-pages";

const MAX_MATERIAL_SOURCES = 5;

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

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export function loadGoalMaterial(goalId: string): Promise<MaterialSource[]> {
  return findMaterial([goalId]);
}

const MAX_COURSE_MATERIAL = 12_000;

/** Internal: the course must come from the outline workflow holding its claim. */
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

function standInGoalsFilter({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  return {
    plan: {
      graph: { array_contains: [{ courseIds: [courseId] }], path: ["skills"] },
      items: {
        some: {
          lessonId: null,
          skill: { lessons: { some: { lessonId } } },
          status: "todo" as const,
        },
      },
    },
  };
}

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
      ...(courseId
        ? [{ primaryCourseId: courseId }, standInGoalsFilter({ courseId, lessonId })]
        : []),
    ],
  };
}

/** Internal: the lesson must come from the workflow holding its claim. */
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
