import { type PlanItem } from "@zoonk/db";
import { countLessons } from "./stand-in-lessons";

/** A plan graph skill at its full size (see `loadSkillSizes`). */
export type SizedSkill = { size: number; skillId: string };

type StudiedItem = Pick<
  PlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

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

  return {
    size: graphSkills.reduce((sum, skill) => sum + skill.size, 0) + countLessons(unsized),
    studied: countLessons(items.filter((item) => item.status === "done")),
  };
}

/** A certificate needs at least half of what it certifies studied on Zoonk. */
export function isHalfStudied({ size, studied }: { size: number; studied: number }): boolean {
  return studied > 0 && studied * 2 >= size;
}
