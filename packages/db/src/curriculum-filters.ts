import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { type Prisma } from "./generated/prisma/client";

type CourseWhere = Prisma.CourseWhereInput;
type ChapterWhere = Omit<Prisma.ChapterWhereInput, "course">;
type LessonWhere = Omit<Prisma.LessonWhereInput, "chapter">;
type StepWhere = Omit<Prisma.StepWhereInput, "lesson">;

/**
 * Generation entry points are only supposed to operate on the public AI
 * curriculum. Centralizing that constraint here keeps route handlers, server
 * pages, and workflow steps aligned when they load raw ids for generation.
 */
export function getAiGenerationCourseWhere(where: CourseWhere = {}): Prisma.CourseWhereInput {
  return {
    ...where,
    organization: { slug: AI_ORG_SLUG },
  };
}

/**
 * Public course reads need both visibility requirements:
 * the course itself must be published, and nested helpers add the matching
 * published checks for every descendant in the curriculum tree.
 */
export function getPublishedCourseWhere(where: CourseWhere = {}): Prisma.CourseWhereInput {
  return {
    ...where,
    isPublished: true,
  };
}

/**
 * Raw-id generation routes must only load chapters that belong to the public
 * AI organization. Without this helper, any chapter id could be treated
 * as eligible for lesson generation just because the row exists.
 */
export function getAiGenerationChapterWhere({
  chapterWhere = {},
  courseWhere = {},
}: {
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
} = {}): Prisma.ChapterWhereInput {
  return {
    ...chapterWhere,
    course: getAiGenerationCourseWhere(courseWhere),
  };
}

/**
 * Public chapter reads should only see chapters that are still visible in the
 * live catalog, which means both the chapter and its parent course must be
 * published.
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
    course: getPublishedCourseWhere(courseWhere),
    isPublished: true,
  };
}

/**
 * Lesson generation is also keyed by raw ids, so every entry point needs one
 * shared definition of "AI-owned lesson". Tying the org check to the full
 * ancestor chain avoids route-level drift when lessons are loaded indirectly.
 */
export function getAiGenerationLessonWhere({
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
    chapter: getAiGenerationChapterWhere({ chapterWhere, courseWhere }),
  };
}

/**
 * Public lesson reads need the published constraint at every level of the
 * curriculum tree, not only on the lesson row itself.
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
    chapter: getPublishedChapterWhere({ chapterWhere, courseWhere }),
    isPublished: true,
  };
}

/**
 * Public step reads need both the step and the containing lesson tree to be
 * published because callers often start from raw ids or positions.
 */
export function getPublishedStepWhere({
  chapterWhere = {},
  courseWhere = {},
  lessonWhere = {},
  stepWhere = {},
}: {
  chapterWhere?: ChapterWhere;
  courseWhere?: CourseWhere;
  lessonWhere?: LessonWhere;
  stepWhere?: StepWhere;
} = {}): Prisma.StepWhereInput {
  return {
    ...stepWhere,
    isPublished: true,
    lesson: getPublishedLessonWhere({ chapterWhere, courseWhere, lessonWhere }),
  };
}
