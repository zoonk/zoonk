import { type PlanItem } from "@zoonk/db";
import { countLessons } from "./stand-in-lessons";

/** A plan graph skill at its full size (see `loadSkillSizes`). */
export type SizedSkill = { size: number; skillId: string };

type StudiedItem = Pick<
  PlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

/**
 * Each skill counts at its full size, so a plan trimmed to fit a date can't earn a certificate by
 * finishing what it kept, and never below the lessons the plan holds for it, so a re-plan or a merge
 * that shrinks the graph can't drop lessons the learner already has. A skill the graph doesn't hold
 * counts its own items.
 */
export function measureStudied({
  graphSkills,
  items,
}: {
  graphSkills: readonly SizedSkill[];
  items: readonly StudiedItem[];
}): { size: number; studied: number } {
  const sized = new Set(graphSkills.map((skill) => skill.skillId));
  const held = Map.groupBy(items, (item) => item.skillId ?? "");
  const unsized = items.filter((item) => !item.skillId || !sized.has(item.skillId));

  return {
    size:
      graphSkills.reduce(
        (sum, skill) => sum + Math.max(skill.size, countLessons(held.get(skill.skillId) ?? [])),
        0,
      ) + countLessons(unsized),
    studied: countLessons(items.filter((item) => item.status === "done")),
  };
}

/** A certificate needs at least half of what it certifies studied on Zoonk. */
export function isHalfStudied({ size, studied }: { size: number; studied: number }): boolean {
  return studied > 0 && studied * 2 >= size;
}
