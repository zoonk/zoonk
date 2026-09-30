import { type SkillStateCounts, countSkillStates } from "../../learner/mastery-state";

type GroupableSkill = {
  areaId: string | null;
  areaTitle: string | null;
  fading: boolean;
  sectionTitle?: string | null;
  state: "learning" | "mastered" | "new" | "solid";
};

/**
 * One area (a chapter, or a phase before its chapters exist) with its skills and their counts, and
 * the section it sits in: the course or exam subject the goal's graph put its skills in.
 */
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

/** Skills outside any plan area (started elsewhere) share one group. */
const OTHER_AREA_ID = "other";

/**
 * Groups skills by area in the order the areas first appear, which is plan order for a goal's
 * skills. Each group carries the counts both modes show: gold, fading and the rest.
 */
export function groupSkillsByArea<TSkill extends GroupableSkill>(
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

/**
 * Groups skills by section (course or exam subject), then by area inside it: sections in the order
 * they first appear, areas in plan order within each. An exam plan interleaves subjects by
 * priority, so without this the same subject would come back several times.
 */
export function groupSkillsBySection<TSkill extends GroupableSkill>(
  skills: readonly TSkill[],
): SkillGroup<TSkill>[] {
  const bySection = Map.groupBy(groupSkillsByArea(skills), (group) => group.section ?? "");
  return [...bySection.values()].flat();
}

function byRecall(a: Pick<RecallSkill, "retrievability">, b: Pick<RecallSkill, "retrievability">) {
  return (a.retrievability ?? 1) - (b.retrievability ?? 1);
}

/** The fading skills, most faded first. */
export function listFadingSkills(skills: readonly RecallSkill[]) {
  return skills
    .filter((skill) => skill.fading)
    .map(({ name, retrievability, skillId }) => ({ name, retrievability, skillId }))
    .toSorted(byRecall);
}
