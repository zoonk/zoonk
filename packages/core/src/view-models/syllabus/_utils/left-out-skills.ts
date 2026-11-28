import { getNotPlannedReason } from "./syllabus-topics";

type LeftOutFacts = {
  /** Skills the plan holds work of, within its lesson scope. */
  heldSkillIds: ReadonlySet<string>;
  knownSkillIds: ReadonlySet<string>;
  pastBasicsSkillIds: ReadonlySet<string>;
  skippedAreas: readonly string[];
  skippedBaseIds?: ReadonlySet<string>;
};

/** The skills the plan leaves out for time, in the order given. */
export function listLeftOutSkills<TSkill extends { area: string; skillId: string }>({
  facts,
  skills,
}: {
  facts: LeftOutFacts;
  skills: readonly TSkill[];
}): TSkill[] {
  return skills.flatMap((skill) =>
    getNotPlannedReason({
      hasItems: facts.heldSkillIds.has(skill.skillId),
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
