import { type PlanItem } from "@zoonk/db";
import { getWorkProgress } from "../../../plans/_utils/work-progress";
import { getNotPlannedReason } from "./syllabus-topics";

type LeftOutFacts = {
  /** Skills the plan holds work of, within its lesson scope. */
  heldSkillIds: ReadonlySet<string>;
  knownSkillIds: ReadonlySet<string>;
  pastBasicsSkillIds: ReadonlySet<string>;
  skippedAreas: readonly string[];
  skippedBaseIds?: ReadonlySet<string>;
};

/** The skills the plan still holds work of: lessons set aside for time don't hold theirs. */
export function listHeldSkillIds(
  items: readonly Pick<PlanItem, "skillId" | "status">[],
): Set<string> {
  return new Set(
    items.flatMap((item) =>
      item.skillId && getWorkProgress(item.status) !== "setAside" ? [item.skillId] : [],
    ),
  );
}

/**
 * The skills the plan leaves out for time, in the order given. Lessons an undated plan owes for
 * later are still in it.
 */
export function listLeftOutSkills<
  TSkill extends { area: string; deferredLessons?: number; skillId: string },
>({ facts, skills }: { facts: LeftOutFacts; skills: readonly TSkill[] }): TSkill[] {
  return skills.flatMap((skill) =>
    getNotPlannedReason({
      hasItems: facts.heldSkillIds.has(skill.skillId) || (skill.deferredLessons ?? 0) > 0,
      hasSkills: true,
      known: facts.knownSkillIds.has(skill.skillId),
      pastBasics: facts.pastBasicsSkillIds.has(skill.skillId),
      skipped: facts.skippedAreas.includes(skill.area),
      skippedBase: facts.skippedBaseIds?.has(skill.skillId) ?? false,
    }) === "time"
      ? [skill]
      : [],
  );
}
