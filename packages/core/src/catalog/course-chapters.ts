import "server-only";
import { getCatalogCourse } from "./_utils/catalog-course";

/**
 * Lists a catalog course's chapters in reading order, each with the level band the course places
 * it in, its position across the whole outline and its visible lessons. Null when the viewer
 * can't open the course: it isn't a published brand course or their own private course.
 */
export async function listCatalogCourseChapters({ courseId }: { courseId: string }) {
  const catalog = await getCatalogCourse(courseId);

  if (!catalog) {
    return null;
  }

  return catalog.placements.map((placement) => ({ ...placement, courseId: catalog.course.id }));
}
