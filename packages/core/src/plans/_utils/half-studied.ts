import { type PlanItem } from "@zoonk/db";
import { isStandIn } from "../planner/plan-item-rules";
import { countLessons } from "./stand-in-lessons";

/** A written lesson the plan counts, the chapter it's placed in, and the plan's graph skills it teaches. */
export type CountedLesson = {
  chapterId: string | null;
  lessonId: string;
  skillIds: readonly string[];
};

/** A graph skill's lessons nobody has written yet: none once it's outlined. */
export type UnwrittenLessons = { lessons: number; skillId: string };

/** What a plan holds to study, read from content links rather than from the planner's choices. */
export type PlanScope = {
  /** Every skill of the plan's graph, a merged one under its survivor. */
  graphSkillIds: readonly string[];
  /** The graph's skills outside the areas the learner removed. */
  keptSkills: readonly { courseIds?: readonly string[]; skillId: string }[];
  lessons: readonly CountedLesson[];
  unwritten: readonly UnwrittenLessons[];
};

type StudiedItem = Pick<
  PlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

/**
 * Each written lesson counts once however many skills it teaches, so a re-plan that shares lessons
 * out among skills again, a test-out or a dated plan's cuts can't change the size.
 */
export function measureStudied({
  items,
  lessonIds,
  unwritten,
}: {
  items: readonly StudiedItem[];
  lessonIds: ReadonlySet<string>;
  unwritten: number;
}): { size: number; studied: number } {
  const done = items.filter((item) => item.status === "done");

  const studied = new Set(
    done.flatMap((item) => item.lessonId ?? []).filter((id) => lessonIds.has(id)),
  );

  return {
    size: lessonIds.size + unwritten,
    studied: studied.size + countLessons(done.filter((item) => isStandIn(item))),
  };
}

/** A certificate needs at least half of what it certifies studied on Zoonk. */
export function isHalfStudied({ size, studied }: { size: number; studied: number }): boolean {
  return studied > 0 && studied * 2 >= size;
}
