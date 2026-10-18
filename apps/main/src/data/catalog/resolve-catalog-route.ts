import "server-only";
import { getCourseHref } from "@/data/courses/course-href";
import { type CourseWithDetails, getCourse } from "@zoonk/core/courses/get-by-slug";
import { getLibraryCourse } from "@zoonk/core/library/courses/get";
import { findOutlineChapter, findOutlineLesson } from "@zoonk/core/library/routes/outline";
import { decodeRouteParam } from "@zoonk/core/navigation/decode-route-param";
import { isListedCourse } from "@zoonk/db";

export type LibraryOutline = NonNullable<Awaited<ReturnType<typeof getLibraryCourse>>>;
type OutlineChapter = LibraryOutline["levels"][number]["chapters"][number];
type OutlineLesson = OutlineChapter["lessons"][number];

type CourseParams = { brandSlug: string; courseSlug: string };
type ChapterParams = CourseParams & { chapterSlug: string };
type LessonParams = ChapterParams & { lessonSlug: string };

type Missing = { kind: "notFound" } | { href: ReturnType<typeof getCourseHref>; kind: "redirect" };

export type LibraryCourseRoute = {
  course: CourseWithDetails;
  /** Whether search engines may index the course's pages: only once the catalog lists it. */
  isListed: boolean;
  kind: "library";
  outline: LibraryOutline;
};

export type LibraryChapterRoute = LibraryCourseRoute & {
  chapter: OutlineChapter;
  number: number;
  total: number;
};

export type LibraryLessonRoute = LibraryChapterRoute & { lesson: OutlineLesson };

type CourseRoute = { kind: "notFound" } | LibraryCourseRoute;
type ChapterRoute = Missing | LibraryChapterRoute;
type LessonRoute = Missing | LibraryLessonRoute;

/**
 * Decides whether a public course URL shows the Library course page. Every
 * published course has one, even before its outline is written.
 */
export async function resolveCourseRoute(params: CourseParams): Promise<CourseRoute> {
  const course = await getCourse(params);

  if (!course) {
    return { kind: "notFound" };
  }

  const outline = await getLibraryCourse({ courseId: course.id });

  if (!outline) {
    return { kind: "notFound" };
  }

  return { course, isListed: isListedCourse(course), kind: "library", outline };
}

/**
 * A chapter or lesson URL whose course exists but whose chapter or lesson
 * doesn't (for example, an old URL from before the Library) moves permanently
 * to the course page, so old links and search results keep working.
 */
function redirectToCourse(params: CourseParams): Missing {
  return { href: getCourseHref(params), kind: "redirect" };
}

/** Decides which page a public chapter URL shows, or where it moved. */
export async function resolveChapterRoute(params: ChapterParams): Promise<ChapterRoute> {
  const courseRoute = await resolveCourseRoute(params);

  if (courseRoute.kind === "notFound") {
    return courseRoute;
  }

  const found = findOutlineChapter({
    chapterSlug: decodeRouteParam(params.chapterSlug),
    courseId: courseRoute.course.id,
    levels: courseRoute.outline.levels,
  });

  if (!found) {
    return redirectToCourse(params);
  }

  return { ...courseRoute, ...found };
}

/** Decides which page a public lesson URL shows, or where it moved. */
export async function resolveLessonRoute(params: LessonParams): Promise<LessonRoute> {
  const chapterRoute = await resolveChapterRoute(params);

  if (chapterRoute.kind !== "library") {
    return chapterRoute;
  }

  const lesson = findOutlineLesson({
    chapterId: chapterRoute.chapter.id,
    lessonSlug: decodeRouteParam(params.lessonSlug),
    lessons: chapterRoute.chapter.lessons,
  });

  if (!lesson) {
    return redirectToCourse(params);
  }

  return { ...chapterRoute, lesson };
}
