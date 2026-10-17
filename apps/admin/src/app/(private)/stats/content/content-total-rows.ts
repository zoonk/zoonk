import { type ContentCounts } from "@/data/stats/_utils/content-created";
import { type countLibraryContent } from "@/data/stats/count-library-content";
import { type ContentTotalRow } from "./content-totals-table";

type LibraryTotals = Awaited<ReturnType<typeof countLibraryContent>>;

/** Library inventory rows, in the order content is built: outline, lessons, practice, media. */
export function getContentTotalRows({
  created,
  totals,
}: {
  created: ContentCounts;
  totals: LibraryTotals;
}): ContentTotalRow[] {
  return [
    { created: created.courses, title: "Courses", total: totals.courses },
    { created: created.chapters, title: "Chapters", total: totals.chapters },
    { created: created.lessons, title: "Lessons (generated)", total: totals.lessons },
    { title: "Lesson outlines", total: totals.lessonOutlines },
    { created: created.steps, title: "Steps", total: totals.steps },
    { created: created.skills, title: "Skills", total: totals.skills },
    { created: created.items, title: "Items", total: totals.items },
    { created: created.images, title: "Images", total: totals.images },
    { created: created.audio, title: "Audio", total: totals.audio },
    { created: created.sources, title: "Sources", total: totals.sources },
    { created: created.examBlueprints, title: "Exam blueprints", total: totals.examBlueprints },
  ];
}
