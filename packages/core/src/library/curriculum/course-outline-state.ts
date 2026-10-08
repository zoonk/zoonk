import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
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

/**
 * The goal skills this course doesn't teach yet: no lesson of its chapters teaches the skill and
 * none of its chapters tagged with it has a lesson. Only these need an outline. Skills are shared
 * across courses, but another subject's lessons for them teach other content (reading for the
 * main idea in English is not in Portuguese), so only this course's own chapters count; a course
 * on the same subject gets its chapters and lessons through identity search when the outline asks.
 * For a goal whose plan leaves out chapters that need a tool (`withToolChapters` false: an exam
 * answered without one), those chapters don't count either: its skills need chapters without them.
 */
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

/**
 * What writing one level band needs to know about the course: every chapter title it already has
 * (so the band doesn't repeat them), the first free position in the band, and, for a private
 * course built from the learner's own class material, that material (see `loadCourseMaterial`).
 */
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

/**
 * Claims the course's outline for this run. A course whose outline is already written can still
 * lack a later goal's skills; the caller only claims it when some are missing, so it is reopened
 * for this run to add the chapters that teach them.
 */
export async function claimCourseOutline({
  courseId,
  workflowRunId,
}: {
  courseId: string;
  workflowRunId: string;
}): Promise<Exclude<LibraryClaimResult, "completed">> {
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

  revalidateCacheTags([getCourseCacheTag(courseId), getCourseCurriculumCacheTag(courseId)]);

  return "claimed";
}

/**
 * Frees a course whose outline claim is held by a run that is no longer running, so the next run
 * can write the outline. Only that run's claim changes.
 */
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

/** The run holding a course's outline claim, or null when nobody is writing it. */
export async function getCourseOutlineOwner(courseId: string): Promise<string | null> {
  const course = await prisma.course.findUnique({
    select: { outlineRunId: true, outlineStatus: true },
    where: { id: courseId },
  });

  return course?.outlineStatus === "running" ? course.outlineRunId : null;
}

/**
 * What changes when a course is listed: its page, the catalog, and its public address, which
 * cached "not found" if anyone opened it while the course was still unlisted.
 */
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

/**
 * Ends the course's outline claim. A shared course is listed once its first outline is written;
 * a private one never is.
 */
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
    revalidateCacheTags(await getListedCourseTags(courseId));
  }
}
