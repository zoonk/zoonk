import "server-only";
import { getLibraryChapter } from "../../library/chapters/get-library-chapter";
import { getCatalogCourse } from "./catalog-course";

function getHomeCatalogCourse(homeCourseId: string | null) {
  return homeCourseId ? getCatalogCourse(homeCourseId) : null;
}

/**
 * A chapter can be placed in several courses, so every chapter read happens in one course: the
 * given one, or the chapter's home course (the one it was written for) when none is given. The
 * course must be in the catalog and its visible outline must place the chapter; otherwise the
 * chapter isn't found there.
 */
export async function getCatalogChapterPlacement({
  chapterId,
  courseId,
}: {
  chapterId: string;
  courseId?: string;
}) {
  const [chapter, givenCourse] = await Promise.all([
    getLibraryChapter({ chapterId }),
    courseId ? getCatalogCourse(courseId) : null,
  ]);

  if (!chapter) {
    return null;
  }

  const catalog = courseId ? givenCourse : await getHomeCatalogCourse(chapter.homeCourseId);
  const placement = catalog?.placements.find((item) => item.chapter.id === chapter.id);

  if (!catalog || !placement) {
    return null;
  }

  return { chapter, course: catalog.course, level: placement.level, position: placement.position };
}
