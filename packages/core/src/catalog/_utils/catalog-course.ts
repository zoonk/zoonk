import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getCourseById } from "../../courses/get-course-by-id";
import { getLibraryCourse } from "../../library/courses/get-library-course";

type LibraryCourse = NonNullable<Awaited<ReturnType<typeof getLibraryCourse>>>;
type LevelBand = LibraryCourse["levels"][number];

/** A chapter where a course places it: its level band and its 0-based position across every band. */
export type CatalogPlacement = {
  chapter: LevelBand["chapters"][number];
  level: LevelBand["level"];
  position: number;
};

function toPlacements(levels: LibraryCourse["levels"]): CatalogPlacement[] {
  return levels
    .flatMap((band) => band.chapters.map((chapter) => ({ chapter, level: band.level })))
    .map((placement, position) => ({ ...placement, position }));
}

/**
 * The catalog serves published brand courses to everyone and a private course to its owner only.
 * Returns the course with its visible outline in reading order (overview to advanced), or null
 * when the viewer can't open the course. A private course has no organization.
 */
export async function getCatalogCourse(courseId: string) {
  if (!isUuid(courseId)) {
    return null;
  }

  const [course, outline] = await Promise.all([
    getCourseById({ courseId }),
    getLibraryCourse({ courseId }),
  ]);

  if (!course || !outline) {
    return null;
  }

  return { course, placements: toPlacements(outline.levels) };
}
