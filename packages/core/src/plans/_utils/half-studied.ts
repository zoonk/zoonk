import { type PlanItem } from "@zoonk/db";
import { type PlanGraphSkill } from "../planner/plan-state";
import { countLessons } from "./stand-in-lessons";

type SizedSkill = Pick<PlanGraphSkill, "lessons" | "plannedLessons" | "skillId">;

type StudiedItem = Pick<
  PlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

/**
 * A skill's full size, even where a dated plan trims it or leaves it out; 0 when it's out by choice.
 * A re-plan also sizes a tested-out skill at 0, so it counts at its graph size instead.
 */
function getSkillSize({
  skill,
  testedOut,
}: {
  skill: SizedSkill;
  testedOut: ReadonlySet<string>;
}): number {
  return testedOut.has(skill.skillId) ? skill.lessons : (skill.plannedLessons ?? skill.lessons);
}

/**
 * The size is the graph's, not what's left in the plan, so a plan trimmed to fit a date can't earn
 * a certificate by finishing what it kept. A skill the graph doesn't hold counts its own items.
 */
export function measureStudied({
  graphSkills,
  items,
}: {
  graphSkills: readonly SizedSkill[];
  items: readonly StudiedItem[];
}): { size: number; studied: number } {
  const sized = new Set(graphSkills.map((skill) => skill.skillId));
  const unsized = items.filter((item) => !item.skillId || !sized.has(item.skillId));

  const testedOut = new Set(
    items.flatMap((item) => (item.status === "testedOut" && item.skillId ? item.skillId : [])),
  );

  return {
    size:
      graphSkills.reduce((sum, skill) => sum + getSkillSize({ skill, testedOut }), 0) +
      countLessons(unsized),
    studied: countLessons(items.filter((item) => item.status === "done")),
  };
}

/** A certificate needs at least half of what it certifies studied on Zoonk. */
export function isHalfStudied({ size, studied }: { size: number; studied: number }): boolean {
  return studied > 0 && studied * 2 >= size;
}
