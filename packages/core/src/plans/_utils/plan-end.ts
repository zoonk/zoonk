import { type PlanItem } from "@zoonk/db";
import { type PlanEndView } from "../plan-view-contract";
import { type ExistingPlanItem } from "../planner/plan-items";
import { countLessons } from "./stand-in-lessons";
import { getWorkProgress } from "./work-progress";

/** Lessons and chapters are what a plan teaches; checkpoints and reviews come around them. */
const LEARN_KINDS = new Set<PlanItem["kind"]>(["chapter", "lesson"]);

/** An exam's rehearsals and the reviews before its day: a plan isn't over while one is ahead. */
const EXAM_DAY_KINDS = new Set<PlanItem["kind"]>(["mock", "review"]);

type EndItem = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

const isTodo = (item: Pick<PlanItem, "status">) => getWorkProgress(item.status) === "todo";

/**
 * Nothing of the plan is left to do: every lesson and chapter is behind the learner, even with a
 * final checkpoint ahead, and an exam's mocks and the reviews before it too (tested out days before
 * a class test, its lessons leave the short mock to do). Finished or ended (see `getPlanEnd`): what
 * to study next shows, and the course's next level opens, either way.
 */
export function isPlanOver(items: readonly Pick<PlanItem, "kind" | "status">[]): boolean {
  const learn = items.filter((item) => LEARN_KINDS.has(item.kind));

  return (
    learn.length > 0 &&
    !learn.some((item) => isTodo(item)) &&
    !items.some((item) => EXAM_DAY_KINDS.has(item.kind) && isTodo(item))
  );
}

/**
 * Where a plan with nothing left to do stands (`isPlanOver`): `finished` once every lesson and
 * chapter was studied or tested out, and `ended` when some were set aside (missed days the plan
 * couldn't fit back, or its date came), with how many lessons stayed out. Ended is never finished:
 * Rafaela's plan would have said "You finished your plan" over lessons she never studied. Null
 * while something is left.
 */
export function getPlanEnd(items: readonly EndItem[]): PlanEndView | null {
  if (!isPlanOver(items)) {
    return null;
  }

  const setAsideLessons = countLessons(
    items.filter(
      (item) => LEARN_KINDS.has(item.kind) && getWorkProgress(item.status) === "setAside",
    ),
  );

  return { kind: setAsideLessons > 0 ? "ended" : "finished", setAsideLessons };
}
