import { parsePlanGraph } from "../../plans/planner/plan-state";

export type ProjectedPlanItem = {
  chapterId: string | null;
  id: string;
  lessonId: string | null;
  phase: number;
  skillId: string | null;
};

export type SkillEntry = { areaId: string; phase: number; planItemId: string; skillId: string };

/** Chapter lessons and their skills must be in teaching order. */
export type ItemSkillRows = {
  chapterLessons: readonly {
    chapterId: string;
    lesson: { skills: readonly { skillId: string }[] };
  }[];
  lessonSkills: readonly {
    lesson: { homeChapterId: string | null };
    lessonId: string;
    skillId: string;
  }[];
};

export function unique<TValue>(values: readonly (TValue | null)[]): TValue[] {
  return [...new Set(values.filter((value) => value !== null))];
}

export function getPhaseAreaId(phase: number): string {
  return `phase:${phase}`;
}

export function expandItem({
  item,
  skills,
}: {
  item: ProjectedPlanItem;
  skills: ItemSkillRows;
}): SkillEntry[] {
  const fallbackArea = item.chapterId ?? getPhaseAreaId(item.phase);
  const base = { phase: item.phase, planItemId: item.id };

  if (item.skillId) {
    return [{ ...base, areaId: fallbackArea, skillId: item.skillId }];
  }

  if (item.lessonId) {
    return skills.lessonSkills
      .filter((row) => row.lessonId === item.lessonId)
      .map((row) => ({
        ...base,
        areaId: item.chapterId ?? row.lesson.homeChapterId ?? fallbackArea,
        skillId: row.skillId,
      }));
  }

  return skills.chapterLessons
    .filter((row) => row.chapterId === item.chapterId)
    .flatMap((row) => row.lesson.skills)
    .map((row) => ({ ...base, areaId: fallbackArea, skillId: row.skillId }));
}

export function firstPerSkill(entries: readonly SkillEntry[]): SkillEntry[] {
  return entries.filter(
    (entry, index) => entries.findIndex((other) => other.skillId === entry.skillId) === index,
  );
}

/** Empty plans still need graph skills for mocks and review when no teaching fits. */
export function toGraphEntries(graph: unknown): SkillEntry[] {
  return parsePlanGraph(graph).skills.map((skill) => ({
    areaId: getPhaseAreaId(skill.phase),
    phase: skill.phase,
    planItemId: "",
    skillId: skill.skillId,
  }));
}

/** Resolves merged skills, preserves teaching order, and falls back to the graph when no item teaches a skill. */
export function projectPlanSkills({
  graph,
  items,
  rows,
  survivorOf,
}: {
  graph: unknown;
  items: readonly ProjectedPlanItem[];
  rows: ItemSkillRows;
  survivorOf: (skillId: string) => string;
}): { itemSkillIds: Map<string, string[]>; skillIds: string[] } {
  const expanded = items.flatMap((item) => expandItem({ item, skills: rows }));
  const planned = expanded.length > 0 ? expanded : toGraphEntries(graph);
  const entries = planned.map((entry) => ({ ...entry, skillId: survivorOf(entry.skillId) }));

  return {
    itemSkillIds: new Map(
      items.map((item) => [
        item.id,
        unique(
          entries.filter((entry) => entry.planItemId === item.id).map((entry) => entry.skillId),
        ),
      ]),
    ),
    skillIds: firstPerSkill(entries).map((entry) => entry.skillId),
  };
}
