import "server-only";
import { type CourseLevel, DbNull, prisma } from "@zoonk/db";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import {
  COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getCourseRouteCacheTag,
} from "../../cache/tags";
import { libraryRowsVisibleTo } from "../_utils/library-visibility";
import { needsTool } from "../chapters/chapter-tools";
import {
  type LibraryClaimResult,
  claimLibraryGeneration,
  finishLibraryGeneration,
} from "../claims/generation-claim";
import { loadCourseMaterial } from "../sources/goal-material";

export async function findUntaughtSkills({
  courseId,
  ownerId,
  skillIds,
  withToolChapters = true,
}: {
  courseId: string;
  ownerId: string | null;
  skillIds: readonly string[];
  withToolChapters?: boolean;
}): Promise<string[]> {
  const visible = libraryRowsVisibleTo(ownerId);
  const inCourse = { courses: { some: { courseId } } };

  const [byLesson, byChapter] = await Promise.all([
    prisma.lessonSkill.findMany({
      select: {
        lesson: {
          select: {
            chapters: {
              select: { chapter: { select: { tools: true } } },
              where: { chapter: inCourse },
            },
          },
        },
        skillId: true,
      },
      where: {
        lesson: { ...visible, chapters: { some: { chapter: inCourse } } },
        skillId: { in: [...skillIds] },
      },
    }),
    prisma.chapterSkill.findMany({
      select: { chapter: { select: { tools: true } }, skillId: true },
      where: {
        chapter: { ...visible, ...inCourse, lessons: { some: {} } },
        skillId: { in: [...skillIds] },
      },
    }),
  ]);

  const counts = (tools: unknown) => withToolChapters || !needsTool(tools);

  const taught = new Set([
    ...byLesson
      .filter((row) => row.lesson.chapters.some((entry) => counts(entry.chapter.tools)))
      .map((row) => row.skillId),
    ...byChapter.filter((row) => counts(row.chapter.tools)).map((row) => row.skillId),
  ]);

  return skillIds.filter((skillId) => !taught.has(skillId));
}

export async function getCourseBandContext({
  courseId,
  level,
}: {
  courseId: string;
  level: CourseLevel;
}): Promise<{
  chapterTitles: string[];
  material: string | null;
  nextPosition: number;
  title: string;
}> {
  const course = await prisma.course.findUniqueOrThrow({
    include: {
      courseChapters: {
        include: { chapter: { select: { title: true } } },
        orderBy: { position: "asc" },
      },
    },
    where: { id: courseId },
  });

  const band = course.courseChapters.filter((placement) => placement.level === level);

  return {
    chapterTitles: course.courseChapters.map((placement) => placement.chapter.title),
    material: await loadCourseMaterial(course),
    nextPosition:
      band.length === 0 ? 0 : Math.max(...band.map((placement) => placement.position)) + 1,
    title: course.title,
  };
}

/** The courses kept from before learning v2 are the only ones no run made. */
const LEGACY_COURSE = { runId: null };

/**
 * A course from before learning v2 lost its chapters in the cutover and keeps its old details on
 * its pages until its first outline clears them.
 */
async function startLegacyCourseOver(courseId: string): Promise<void> {
  const cleared = await prisma.$transaction(async (tx) => {
    const { count } = await tx.course.updateMany({
      data: { description: null, imageUrl: null, landingPage: DbNull },
      where: { ...LEGACY_COURSE, courseChapters: { none: {} }, id: courseId },
    });

    if (count > 0) {
      await tx.courseCategory.deleteMany({ where: { courseId } });
    }

    return count > 0;
  });

  if (cleared) {
    await revalidateCourseContent(await getListedCourseTags(courseId));
  }
}

export async function needsLegacyCourseDetails(courseId: string): Promise<boolean> {
  const count = await prisma.course.count({
    where: { ...LEGACY_COURSE, description: null, id: courseId },
  });

  return count > 0;
}

export async function claimCourseOutline({
  courseId,
  workflowRunId,
}: {
  courseId: string;
  workflowRunId: string;
}): Promise<Exclude<LibraryClaimResult, "completed">> {
  await startLegacyCourseOver(courseId);

  const claim = await claimLibraryGeneration({
    id: courseId,
    target: "courseOutline",
    workflowRunId,
  });

  if (claim !== "completed") {
    return claim;
  }

  const { count } = await prisma.course.updateMany({
    data: { outlineRunId: workflowRunId, outlineStatus: "running" },
    where: { id: courseId, outlineStatus: "completed" },
  });

  if (count === 0) {
    return "running";
  }

  await revalidateCourseContent([
    getCourseCacheTag(courseId),
    getCourseCurriculumCacheTag(courseId),
  ]);

  return "claimed";
}

export async function releaseStaleCourseOutline({
  courseId,
  staleRunId,
}: {
  courseId: string;
  staleRunId: string;
}): Promise<void> {
  await prisma.course.updateMany({
    data: { outlineStatus: "failed" },
    where: { id: courseId, outlineRunId: staleRunId, outlineStatus: "running" },
  });
}

export async function getCourseOutlineOwner(courseId: string): Promise<string | null> {
  const course = await prisma.course.findUnique({
    select: { outlineRunId: true, outlineStatus: true },
    where: { id: courseId },
  });

  return course?.outlineStatus === "running" ? course.outlineRunId : null;
}

async function getListedCourseTags(courseId: string): Promise<string[]> {
  const course = await prisma.course.findUniqueOrThrow({
    select: { organization: { select: { slug: true } }, slug: true },
    where: { id: courseId },
  });

  const routeTag =
    course.organization &&
    getCourseRouteCacheTag({ brandSlug: course.organization.slug, courseSlug: course.slug });

  return [getCourseCacheTag(courseId), COURSE_LIST_CACHE_TAG, routeTag].filter(
    (tag): tag is string => Boolean(tag),
  );
}

export async function finishCourseOutline({
  courseId,
  status,
  workflowRunId,
}: {
  courseId: string;
  status: "completed" | "failed";
  workflowRunId: string;
}): Promise<void> {
  const finished = await finishLibraryGeneration({
    id: courseId,
    status,
    target: "courseOutline",
    workflowRunId,
  });

  if (!finished || status !== "completed") {
    return;
  }

  const { count } = await prisma.course.updateMany({
    data: { isPublished: true },
    where: { id: courseId, isPublished: false, visibility: "public" },
  });

  if (count > 0) {
    await revalidateCourseContent(await getListedCourseTags(courseId));
  }
}
