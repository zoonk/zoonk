import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { type WorkProgress, getWorkProgress } from "../../../plans/_utils/work-progress";
import { type SyllabusItem } from "./syllabus-input";

/** A tested-out item may represent multiple skills but must still count as one lesson. */
export function uniquePlanItems(items: readonly SyllabusItem[]): SyllabusItem[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function sumWithProgress(items: readonly SyllabusItem[], progress: WorkProgress): number {
  return countLessons(items.filter((item) => getWorkProgress(item.status) === progress));
}

/** Uses planned lesson scope, counting each item once; known lessons stay separate so revoked test-out credit never lowers studied progress. */
export function getSubjectProgress(items: readonly SyllabusItem[]): {
  lessonsDone: number;
  lessonsKnown: number;
  lessonsTotal: number;
} {
  const unique = uniquePlanItems(items);

  return {
    lessonsDone: sumWithProgress(unique, "studied"),
    lessonsKnown: sumWithProgress(unique, "testedOut"),
    lessonsTotal: countLessons(unique),
  };
}
