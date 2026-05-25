import { type CourseGetPayload } from "@zoonk/db";

export const courseContentInclude = {
  _count: { select: { categories: true, chapters: true } },
} as const;

export type CourseWithContentCounts = CourseGetPayload<{ include: typeof courseContentInclude }>;

export type ExistingCourseContent = {
  description: string | null;
  imageUrl: string | null;
  hasCategories: boolean;
  hasChapters: boolean;
};

export const EMPTY_EXISTING_CONTENT: ExistingCourseContent = {
  description: null,
  hasCategories: false,
  hasChapters: false,
  imageUrl: null,
};

/**
 * Course setup only needs to know which persisted content already exists.
 * Keeping that shape small prevents duplicate-run recovery from passing full
 * Prisma rows through workflow branches that only decide what generation to
 * skip.
 */
export function getExistingCourseContent(course: CourseWithContentCounts): ExistingCourseContent {
  return {
    description: course.description,
    hasCategories: course._count.categories > 0,
    hasChapters: course._count.chapters > 0,
    imageUrl: course.imageUrl,
  };
}
