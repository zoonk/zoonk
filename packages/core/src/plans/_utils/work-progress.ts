import { type PlanItemStatus } from "@zoonk/db";
import { type ExistingPlanItem } from "../planner/plan-items";
import { countLessons } from "./stand-in-lessons";

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

export function isWorkFinished(status: PlanItemStatus): boolean {
  const progress = getWorkProgress(status);
  return progress === "studied" || progress === "testedOut";
}

type CountedLesson = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

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
