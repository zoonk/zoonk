import "server-only";
import { CourseLevel, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { cacheTag } from "next/cache";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getLibraryChapterCacheTag,
} from "../../cache/tags";
import { canViewLibraryRow, filterVisibleLibraryRows } from "../_utils/library-visibility";

const LEVEL_ORDER = Object.values(CourseLevel);

/**
 * Outline lessons only carry what the outline writer sets once. Statuses and
 * specs change during generation and are read from the lesson itself, which
 * keeps a large course under the per-entry cache tag limit.
 */
const outlineLessonSelect = {
  description: true,
  estimatedMinutes: true,
  homeChapterId: true,
  id: true,
  level: true,
  ownerId: true,
  slug: true,
  title: true,
  visibility: true,
} as const;

async function getCachedLibraryCourse(courseId: string) {
  "use cache";
  cacheTag(getCourseCacheTag(courseId), getCourseCurriculumCacheTag(courseId));

  const course = await prisma.course.findUnique({
    include: {
      courseChapters: {
        include: {
          chapter: {
            include: {
              lessons: {
                include: { lesson: { select: outlineLessonSelect } },
                orderBy: { position: "asc" },
              },
            },
          },
        },
        orderBy: [{ level: "asc" }, { position: "asc" }],
      },
    },
    where: { id: courseId },
  });

  if (course) {
    cacheTag(...course.courseChapters.map((item) => getLibraryChapterCacheTag(item.chapterId)));
  }

  return course;
}

type CachedCourse = NonNullable<Awaited<ReturnType<typeof getCachedLibraryCourse>>>;
type CachedPlacement = CachedCourse["courseChapters"][number];

async function toOutlineChapter(placement: CachedPlacement) {
  const { lessons, ...chapter } = placement.chapter;

  const visibleLessons = await filterVisibleLibraryRows(
    lessons.map((item) => ({ ...item.lesson, position: item.position })),
  );

  return { ...chapter, lessons: visibleLessons, position: placement.position };
}

/** Bands follow the placement's level, since a shared chapter's band is the course's choice. */
async function toLevelBands(placements: CachedPlacement[]) {
  const chapters = await Promise.all(
    placements.map(async (placement) => ({
      band: placement.level,
      chapter: await toOutlineChapter(placement),
    })),
  );

  return LEVEL_ORDER.map((level) => ({
    chapters: chapters.filter((item) => item.band === level).map((item) => item.chapter),
    level,
  })).filter((band) => band.chapters.length > 0);
}

async function getVisiblePlacements(placements: CachedPlacement[]): Promise<CachedPlacement[]> {
  const visibleChapters = await filterVisibleLibraryRows(placements.map((item) => item.chapter));
  const visibleIds = new Set(visibleChapters.map((chapter) => chapter.id));

  return placements.filter((placement) => visibleIds.has(placement.chapterId));
}

/**
 * Loads a course with its full outline: level bands from overview to advanced,
 * each chapter in order with its objectives, and each lesson's title and
 * one-line description. Private courses, and private chapters or lessons
 * inside a shared outline, are only returned to their owner.
 */
export async function getLibraryCourse({ courseId }: { courseId: string }) {
  if (!isUuid(courseId)) {
    return null;
  }

  const course = await getCachedLibraryCourse(courseId);

  if (!course || !(await canViewLibraryRow({ ...course, ownerId: course.userId }))) {
    return null;
  }

  const { courseChapters, ...details } = course;
  const levels = await toLevelBands(await getVisiblePlacements(courseChapters));

  return { ...details, levels };
}
