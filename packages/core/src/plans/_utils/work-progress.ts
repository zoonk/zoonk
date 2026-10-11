import { type PlanItemStatus } from "@zoonk/db";
import { type ExistingPlanItem } from "../planner/plan-items";
import { countLessons } from "./stand-in-lessons";

/**
 * How a plan item's work counts for the learner, the one reading every screen uses (phases,
 * chapters, topics, subjects, the plan): `studied` (done, a challenge won), `testedOut` (they
 * showed they know it: finished, and shown apart as known), `setAside` (missed days the plan
 * couldn't fit back: never studied, known or finished, though nothing is left to do), or `todo`.
 * Rafaela's first phase read "done" after one lesson and a month away, its other lessons set aside.
 */
export type WorkProgress = "setAside" | "studied" | "testedOut" | "todo";

const PROGRESS: Record<PlanItemStatus, WorkProgress> = {
  done: "studied",
  skipped: "setAside",
  testedOut: "testedOut",
  todo: "todo",
};

export function getWorkProgress(status: PlanItemStatus): WorkProgress {
  return PROGRESS[status];
}

/** The learner finished it: studied it or tested out of it. Work set aside isn't finished. */
export function isWorkFinished(status: PlanItemStatus): boolean {
  const progress = getWorkProgress(status);
  return progress === "studied" || progress === "testedOut";
}

type CountedLesson = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

/**
 * Lessons as every screen counts them, a phase's on the Journey and a plan's in the goal list: the
 * ones studied, of every lesson the plan teaches but those tested out (off the plan, shown apart as
 * known). A stand-in counts the lessons the plan teaches in its place (`countItemLessons`).
 */
export function countLessonProgress(lessons: readonly CountedLesson[]): {
  lessonsDone: number;
  lessonsTotal: number;
} {
  return {
    lessonsDone: countLessons(lessons.filter((item) => getWorkProgress(item.status) === "studied")),
    lessonsTotal: countLessons(
      lessons.filter((item) => getWorkProgress(item.status) !== "testedOut"),
    ),
  };
}
