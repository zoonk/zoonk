import { parsePlanGraph } from "../../plans/planner/plan-state";

/** What a plan item is to the skills it teaches: what it is and what it's planned in. */
export type ProjectedPlanItem = {
  chapterId: string | null;
  id: string;
  lessonId: string | null;
  phase: number;
  skillId: string | null;
};

export type SkillEntry = { areaId: string; phase: number; planItemId: string; skillId: string };

/**
 * The skills the Library says a plan's lessons and chapters teach (see `loadItemSkillRows`): each
 * lesson's, and each chapter's lessons' in order.
 */
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

/**
 * Expands one plan item into its skills in teaching order: the item's own skill, the skills its
 * lesson teaches, or every skill of its chapter's lessons.
 */
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

/**
 * The goal's skills from its skill graph, for a plan whose items no longer carry any: a re-plan
 * with no room left (a class test opened only the day before) drops every lesson, and the mock
 * and reviews still need the goal's skills.
 */
export function toGraphEntries(graph: unknown): SkillEntry[] {
  return parsePlanGraph(graph).skills.map((skill) => ({
    areaId: getPhaseAreaId(skill.phase),
    phase: skill.phase,
    planItemId: "",
    skillId: skill.skillId,
  }));
}

/**
 * A plan's skills as its learner's sessions read them (see `loadGoalPlan`): each item's skills,
 * its own or its lesson's or chapter's, as their surviving skills (`survivorOf`), and the plan's
 * skills, the first time each is taught, in plan order; the skill graph's when no item teaches any.
 */
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
