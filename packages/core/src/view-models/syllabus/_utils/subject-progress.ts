import { countLessonProgress } from "../../../plans/_utils/work-progress";
import { type SyllabusItem } from "./syllabus-input";

/** A tested-out item may represent multiple skills but must still count as one lesson. */
export function uniquePlanItems(items: readonly SyllabusItem[]): SyllabusItem[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

/** Uses planned lesson scope, counting each item once; known lessons stay separate so revoked test-out credit never lowers studied progress. */
export function getSubjectProgress(items: readonly SyllabusItem[]): {
  lessonsDone: number;
  lessonsKnown: number;
  lessonsTotal: number;
} {
  return countLessonProgress(uniquePlanItems(items));
}
