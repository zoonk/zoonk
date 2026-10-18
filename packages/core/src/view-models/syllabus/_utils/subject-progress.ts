import { countLessons } from "../../../plans/_utils/stand-in-lessons";
import { type WorkProgress, getWorkProgress } from "../../../plans/_utils/work-progress";
import { type SyllabusItem } from "./syllabus-input";

/**
 * Each plan item once: a tested-out lesson stands for every skill it covers as the same item (see
 * `withTestedOutSkills`), for their topics, and is still one lesson.
 */
export function uniquePlanItems(items: readonly SyllabusItem[]): SyllabusItem[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function sumWithProgress(items: readonly SyllabusItem[], progress: WorkProgress): number {
  return countLessons(items.filter((item) => getWorkProgress(item.status) === progress));
}

/**
 * Lessons the learner studied, of the ones the plan teaches (the plan's lesson scope, see
 * `isInLessonScope`), in a subject or the whole goal, so finishing the plan reads 100%, as
 * "Finished" says: a plan that cut depth to fit its date read "Finished" at 19 of its graph's 28
 * lessons. What the plan holds is what the learner chose (their time and date), so changing those
 * changes the size; lessons set aside stay in it until studied. Each plan item counts once: a
 * tested-out lesson that stands for each skill it covers (see `withTestedOutSkills`) made a
 * subject read 2 of 3 for 1 of 2. The ones they tested out of count apart (`lessonsKnown`): a miss
 * that takes that credit back never lowers what they studied (Sofia's "25 of 255" read 0 after
 * her first mock).
 */
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
