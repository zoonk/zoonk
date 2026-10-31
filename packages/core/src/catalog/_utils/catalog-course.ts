import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getCourseById } from "../../courses/get-course-by-id";
import { getLibraryCourse } from "../../library/courses/get-library-course";

type LibraryCourse = NonNullable<Awaited<ReturnType<typeof getLibraryCourse>>>;
type LevelBand = LibraryCourse["levels"][number];

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

/** Returns null unless the course is published publicly or belongs to the viewer. */
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
