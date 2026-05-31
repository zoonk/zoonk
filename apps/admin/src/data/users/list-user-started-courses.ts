import "server-only";
import { isAdmin } from "@/lib/admin-guard";
import { prisma } from "@zoonk/db";
import { cache } from "react";

type UserStartedCourseRow = Awaited<ReturnType<typeof findUserStartedCourseRows>>[number];

type UserCompletedCourseChapter = Awaited<
  ReturnType<typeof findUserCompletedCourseChapters>
>[number];

export type UserStartedCourse = UserStartedCourseRow & { completedChapterCount: number };

const cachedListUserStartedCourses = cache(async (userId: string) => {
  if (!(await isAdmin())) {
    return [];
  }

  const courses = await findUserStartedCourseRows({ userId });

  return addCompletedChapterCounts({ courses, userId });
});

/**
 * The detail page passes route params through a cached primitive value so
 * repeated sections can reuse the same database read without object identity
 * breaking React's cache lookup.
 */
export async function listUserStartedCourses(params: { userId: string }) {
  return cachedListUserStartedCourses(params.userId);
}

/**
 * CourseUser is the durable "started this course" record. Including the total
 * chapter count here lets the row show completed chapters with useful context.
 */
function findUserStartedCourseRows({ userId }: { userId: string }) {
  return prisma.courseUser.findMany({
    include: {
      course: {
        include: {
          _count: { select: { chapters: { where: { isPublished: true } } } },
          organization: true,
        },
      },
    },
    orderBy: [{ course: { updatedAt: "desc" } }, { startedAt: "desc" }, { id: "asc" }],
    where: { userId },
  });
}

/**
 * ChapterCompletion stores durable chapter rollups, so counting those rows is
 * cheaper and more faithful than recomputing every lesson inside every course.
 */
async function addCompletedChapterCounts({
  courses,
  userId,
}: {
  courses: UserStartedCourseRow[];
  userId: string;
}): Promise<UserStartedCourse[]> {
  if (courses.length === 0) {
    return [];
  }

  const completions = await findUserCompletedCourseChapters({
    courseIds: courses.map((course) => course.courseId),
    userId,
  });

  const completedChaptersByCourseId = countCompletedChaptersByCourse({ completions });

  return courses.map((course) => ({
    ...course,
    completedChapterCount: completedChaptersByCourseId.get(course.courseId) ?? 0,
  }));
}

/**
 * Fetching only completions for the visible course rows keeps the detail page
 * bounded even for learners with progress across many unrelated courses.
 */
function findUserCompletedCourseChapters({
  courseIds,
  userId,
}: {
  courseIds: string[];
  userId: string;
}) {
  return prisma.chapterCompletion.findMany({
    include: { chapter: { select: { courseId: true } } },
    where: {
      chapter: { course: { isPublished: true }, courseId: { in: courseIds }, isPublished: true },
      userId,
    },
  });
}

/**
 * The course table renders one row per course, so chapter completion rows are
 * grouped once by course id before the render data is assembled.
 */
function countCompletedChaptersByCourse({
  completions,
}: {
  completions: UserCompletedCourseChapter[];
}) {
  const countsByCourseId = new Map<string, number>();

  for (const completion of completions) {
    const courseId = completion.chapter.courseId;
    const completedCount = countsByCourseId.get(courseId) ?? 0;

    countsByCourseId.set(courseId, completedCount + 1);
  }

  return countsByCourseId;
}
