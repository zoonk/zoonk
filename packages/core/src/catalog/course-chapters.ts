import "server-only";
import { getCatalogCourse } from "./_utils/catalog-course";

/** Returns null unless the course is published publicly or belongs to the viewer. */
export async function listCatalogCourseChapters({ courseId }: { courseId: string }) {
  const catalog = await getCatalogCourse(courseId);

  if (!catalog) {
    return null;
  }

  return catalog.placements.map((placement) => ({ ...placement, courseId: catalog.course.id }));
}
