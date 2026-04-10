import { type Prisma } from "./generated/prisma/client";

type CourseWhere = Omit<Prisma.CourseWhereInput, "archivedAt">;
type ChapterWhere = Omit<Prisma.ChapterWhereInput, "archivedAt" | "course">;
type LessonWhere = Omit<Prisma.LessonWhereInput, "archivedAt" | "chapter">;
type ActivityWhere = Omit<Prisma.ActivityWhereInput, "archivedAt" | "lesson">;
type StepWhere = Omit<Prisma.StepWhereInput, "archivedAt" | "activity">;

/**
 * A course stops being part of the active curriculum as soon as it is archived.
 * Keeping that rule in one helper prevents editor, catalog, and progress
 * queries from drifting apart when they need to exclude retired content.
 */
export function getActiveCourseWhere(where: CourseWhere = {}): Prisma.CourseWhereInput {
  return {
    ...where,
    archivedAt: null,
  };
}

/**
 * Public course reads need both visibility requirements:
 * the course must still be published, and it must still belong to the
 * active curriculum instead of an archived branch.
 */
export function getPublishedCourseWhere(where: CourseWhere = {}): Prisma.CourseWhereInput {
  return {
    ...getActiveCourseWhere(where),
    isPublished: true,
  };
}

/**
 * A chapter is only active when both the chapter itself and its parent course
 * are still active. This makes archive behavior follow the tree structure
 * without every caller having to remember the parent check manually.
 */
export function getActiveChapterWhere({
  chapterWhere = {},
  courseWhere = {},
}: {
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
} = {}): Prisma.ChapterWhereInput {
  return {
    ...chapterWhere,
    archivedAt: null,
    course: getActiveCourseWhere(courseWhere),
  };
}

/**
 * Public chapter reads should only see chapters that are still visible in the
 * live catalog, which means both the chapter and its parent course must remain
 * published and unarchived.
 */
export function getPublishedChapterWhere({
  chapterWhere = {},
  courseWhere = {},
}: {
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
} = {}): Prisma.ChapterWhereInput {
  return {
    ...chapterWhere,
    archivedAt: null,
    course: getPublishedCourseWhere(courseWhere),
    isPublished: true,
  };
}

/**
 * Lessons inherit active status from both ancestors above them.
 * If a course or chapter is archived, its lessons should disappear from
 * default reads even when the lesson row itself was never directly archived.
 */
export function getActiveLessonWhere({
  chapterWhere = {},
  courseWhere = {},
  lessonWhere = {},
}: {
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
  lessonWhere?: LessonWhere;
} = {}): Prisma.LessonWhereInput {
  return {
    ...lessonWhere,
    archivedAt: null,
    chapter: getActiveChapterWhere({
      chapterWhere,
      courseWhere,
    }),
  };
}

/**
 * Public lesson reads need the same ancestry rule as active lessons plus the
 * published constraint at every level of the curriculum tree.
 */
export function getPublishedLessonWhere({
  chapterWhere = {},
  courseWhere = {},
  lessonWhere = {},
}: {
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
  lessonWhere?: LessonWhere;
} = {}): Prisma.LessonWhereInput {
  return {
    ...lessonWhere,
    archivedAt: null,
    chapter: getPublishedChapterWhere({
      chapterWhere,
      courseWhere,
    }),
    isPublished: true,
  };
}

/**
 * Activities are still visible only while their full curriculum branch stays
 * active. That includes the lesson, chapter, and course that contain them.
 */
export function getActiveActivityWhere({
  activityWhere = {},
  chapterWhere = {},
  courseWhere = {},
  lessonWhere = {},
}: {
  activityWhere?: ActivityWhere;
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
  lessonWhere?: LessonWhere;
} = {}): Prisma.ActivityWhereInput {
  return {
    ...activityWhere,
    archivedAt: null,
    lesson: getActiveLessonWhere({
      chapterWhere,
      courseWhere,
      lessonWhere,
    }),
  };
}

/**
 * Public activity reads need the activity itself plus its entire ancestor path
 * to remain published and unarchived.
 */
export function getPublishedActivityWhere({
  activityWhere = {},
  chapterWhere = {},
  courseWhere = {},
  lessonWhere = {},
}: {
  activityWhere?: ActivityWhere;
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
  lessonWhere?: LessonWhere;
} = {}): Prisma.ActivityWhereInput {
  return {
    ...activityWhere,
    archivedAt: null,
    isPublished: true,
    lesson: getPublishedLessonWhere({
      chapterWhere,
      courseWhere,
      lessonWhere,
    }),
  };
}

/**
 * Steps also need archive checks because activity revisions can retire old
 * steps without archiving the entire activity. This lets the activity page
 * serve only the currently active steps.
 */
export function getPublishedStepWhere({
  activityWhere = {},
  chapterWhere = {},
  courseWhere = {},
  lessonWhere = {},
  stepWhere = {},
}: {
  activityWhere?: ActivityWhere;
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
  lessonWhere?: LessonWhere;
  stepWhere?: StepWhere;
} = {}): Prisma.StepWhereInput {
  return {
    ...stepWhere,
    activity: getPublishedActivityWhere({
      activityWhere,
      chapterWhere,
      courseWhere,
      lessonWhere,
    }),
    archivedAt: null,
    isPublished: true,
  };
}
