import { type SkillStateCounts, countSkillStates } from "../../learner/mastery-state";

type GroupableSkill = {
  areaId: string | null;
  areaTitle: string | null;
  fading: boolean;
  sectionTitle?: string | null;
  state: "learning" | "mastered" | "new" | "solid";
};

export type SkillGroup<TSkill> = {
  areaId: string;
  counts: SkillStateCounts;
  section: string | null;
  skills: TSkill[];
  title: string;
};

type RecallSkill = {
  fading: boolean;
  name: string;
  retrievability: number | null;
  skillId: string;
};

const OTHER_AREA_ID = "other";

/** Preserves first-seen area order. */
function groupSkillsByArea<TSkill extends GroupableSkill>(
  skills: readonly TSkill[],
): SkillGroup<TSkill>[] {
  const byArea = Map.groupBy(skills, (skill) => skill.areaId ?? OTHER_AREA_ID);

  return [...byArea].map(([areaId, inArea]) => ({
    areaId,
    counts: countSkillStates(inArea),
    section: inArea[0]?.sectionTitle ?? null,
    skills: inArea,
    title: inArea[0]?.areaTitle ?? "",
  }));
}

/** Preserves first-seen sections and plan-order areas within them, keeping interleaved exam subjects together. */
export function groupSkillsBySection<TSkill extends GroupableSkill>(
  skills: readonly TSkill[],
): SkillGroup<TSkill>[] {
  const bySection = Map.groupBy(groupSkillsByArea(skills), (group) => group.section ?? "");
  return [...bySection.values()].flat();
}

function byRecall(a: Pick<RecallSkill, "retrievability">, b: Pick<RecallSkill, "retrievability">) {
  return (a.retrievability ?? 1) - (b.retrievability ?? 1);
}

export function listFadingSkills(skills: readonly RecallSkill[]) {
  return skills
    .filter((skill) => skill.fading)
    .map(({ name, retrievability, skillId }) => ({ name, retrievability, skillId }))
    .toSorted(byRecall);
}
