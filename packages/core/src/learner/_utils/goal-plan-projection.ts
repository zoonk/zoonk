import { getSkillArea } from "../../plans/planner/graph-areas";
import { type PlanGraph, parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";

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

export function expandItems({
  items,
  skills,
}: {
  items: readonly ProjectedPlanItem[];
  skills: ItemSkillRows;
}): SkillEntry[] {
  const lessonRows = Map.groupBy(skills.lessonSkills, (row) => row.lessonId);
  const chapterRows = Map.groupBy(skills.chapterLessons, (row) => row.chapterId);

  return items.flatMap((item) => {
    const fallbackArea = item.chapterId ?? getPhaseAreaId(item.phase);
    const base = { phase: item.phase, planItemId: item.id };

    if (item.skillId) {
      return [{ ...base, areaId: fallbackArea, skillId: item.skillId }];
    }

    if (item.lessonId) {
      return (lessonRows.get(item.lessonId) ?? []).map((row) => ({
        ...base,
        areaId: item.chapterId ?? row.lesson.homeChapterId ?? fallbackArea,
        skillId: row.skillId,
      }));
    }

    return (item.chapterId === null ? [] : (chapterRows.get(item.chapterId) ?? []))
      .flatMap((row) => row.lesson.skills)
      .map((row) => ({ ...base, areaId: fallbackArea, skillId: row.skillId }));
  });
}

export function firstPerSkill(entries: readonly SkillEntry[]): SkillEntry[] {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    if (seen.has(entry.skillId)) {
      return false;
    }

    seen.add(entry.skillId);
    return true;
  });
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
  const expanded = expandItems({ items, skills: rows });
  const planned = expanded.length > 0 ? expanded : toGraphEntries(graph);
  const entries = planned.map((entry) => ({ ...entry, skillId: survivorOf(entry.skillId) }));
  const itemEntries = Map.groupBy(entries, (entry) => entry.planItemId);

  return {
    itemSkillIds: new Map(
      items.map((item) => [
        item.id,
        unique((itemEntries.get(item.id) ?? []).map((entry) => entry.skillId)),
      ]),
    ),
    skillIds: firstPerSkill(entries).map((entry) => entry.skillId),
  };
}

/**
 * A graph skill is in its own area; a lesson's finer skill is in the area of the first plan item
 * that teaches it alongside a graph skill.
 */
export function listRemovedSkillIds({
  entries,
  graph,
  settings,
  survivorOf,
}: {
  entries: readonly SkillEntry[];
  graph: PlanGraph;
  settings: unknown;
  survivorOf: (skillId: string) => string;
}): Set<string> {
  const skipped = new Set(parsePlanSettings(settings).skippedAreas);

  const graphAreas = new Map(
    graph.skills.map((skill) => [survivorOf(skill.skillId), getSkillArea({ graph, skill })]),
  );

  const itemAreas = new Map(
    entries
      .flatMap((entry) => {
        const area = graphAreas.get(entry.skillId);
        return area === undefined ? [] : [[entry.planItemId, area] as const];
      })
      .toReversed(),
  );

  return new Set(
    [...Map.groupBy(entries, (entry) => entry.skillId)].flatMap(([skillId, skillEntries]) => {
      const area =
        graphAreas.get(skillId) ??
        skillEntries
          .map((entry) => itemAreas.get(entry.planItemId))
          .find((itemArea) => itemArea !== undefined);

      return area !== undefined && skipped.has(area) ? [skillId] : [];
    }),
  );
}
