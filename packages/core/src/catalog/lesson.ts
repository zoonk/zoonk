import "server-only";
import { getPublicLibraryLesson } from "../library/lessons/get-public-library-lesson";
import { getCatalogCourse } from "./_utils/catalog-course";

/**
 * A lesson's public page as `courseId` places it: null unless that course is published (or the
 * viewer's own) and its outline holds the lesson, as main's lesson pages resolve through their course.
 */
export async function getCatalogLesson({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const catalog = await getCatalogCourse(courseId);

  const placed = catalog?.placements.some((placement) =>
    placement.chapter.lessons.some((lesson) => lesson.id === lessonId),
  );

  return placed ? getPublicLibraryLesson({ lessonId }) : null;
}
