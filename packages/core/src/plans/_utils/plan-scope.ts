import "server-only";
import { type Goal, type Plan, type PlanItem } from "@zoonk/db";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { getSkippedSkillIds } from "../../sessions/_utils/review-skills";
import { type PlanGraphSkill, parsePlanGraph } from "../planner/plan-state";
import { type CountedLesson, type PlanScope, type UnwrittenLessons } from "./half-studied";
import { loadGoalPlannerLessons } from "./planner-lessons";
import { getWorkProgress } from "./work-progress";

type ScopeGoal = Pick<Goal, "details" | "examBlueprintId" | "kind" | "primaryCourseId" | "userId">;

type ScopeItem = Pick<PlanItem, "kind" | "lessonId" | "skillId" | "status">;

/** A lesson the plan holds that the planner doesn't load, such as a quick lesson, at its item's skill. */
function listHeldLessons({
  items,
  loaded,
  removed,
}: {
  items: readonly ScopeItem[];
  loaded: ReadonlySet<string>;
  removed: ReadonlySet<string>;
}): CountedLesson[] {
  const held = items.flatMap((item) =>
    item.kind === "lesson" &&
    item.lessonId &&
    !loaded.has(item.lessonId) &&
    getWorkProgress(item.status) !== "setAside" &&
    !removed.has(item.skillId ?? "")
      ? [{ lessonId: item.lessonId, skillIds: item.skillId ? [item.skillId] : [] }]
      : [],
  );

  return [...new Map(held.map((lesson) => [lesson.lessonId, lesson])).values()];
}

/** Each kept skill's estimates beyond its written lessons, merged entries' estimates together. */
function listUnwritten({
  entries,
  lessons,
}: {
  entries: readonly PlanGraphSkill[];
  lessons: readonly CountedLesson[];
}): UnwrittenLessons[] {
  const written = Map.groupBy(
    lessons.flatMap((lesson) => lesson.skillIds),
    (skillId) => skillId,
  );

  const estimated = Map.groupBy(
    entries.filter((entry) => !entry.outlined),
    (entry) => entry.skillId,
  );

  return [...estimated].map(([skillId, merged]) => ({
    lessons: Math.max(
      0,
      merged.reduce((sum, entry) => sum + entry.lessons, 0) - (written.get(skillId)?.length ?? 0),
    ),
    skillId,
  }));
}

/**
 * Read from content links, never from how the planner shares lessons out: none in an area the
 * learner removed or held back for good. A merged graph entry keeps its own area and estimate under
 * the skill it merged into; otherwise a skill's first entry stands for it, as a re-plan resolves it.
 */
export async function loadPlanScope({
  goal,
  plan,
}: {
  goal: ScopeGoal;
  plan: Pick<Plan, "graph" | "settings"> & { items: readonly ScopeItem[] };
}): Promise<PlanScope> {
  const graph = parsePlanGraph(plan.graph);
  const survivorOf = await loadSkillSurvivors(graph.skills.map((skill) => skill.skillId));
  const removed = getSkippedSkillIds({ graph, settings: plan.settings });

  const kept = graph.skills.flatMap((skill) =>
    removed.has(skill.skillId) ? [] : { ...skill, skillId: survivorOf(skill.skillId) },
  );

  const keptIds = new Set(kept.map((entry) => entry.skillId));
  const graphSkillIds = [...new Set(graph.skills.map((skill) => survivorOf(skill.skillId)))];

  const skills = [...Map.groupBy(kept, (entry) => entry.skillId).values()].flatMap(
    ([first, ...rest]) =>
      first
        ? {
            ...first,
            outlined: [first, ...rest].every((entry) => entry.outlined === true) || undefined,
          }
        : [],
  );

  const loaded = await loadGoalPlannerLessons({
    goal,
    graph: { ...graph, skills },
    userId: goal.userId,
  });

  const lessons = [
    ...loaded.map(({ lessonId, skillIds }) => ({ lessonId, skillIds })),
    ...listHeldLessons({
      items: plan.items,
      loaded: new Set(loaded.map((lesson) => lesson.lessonId)),
      removed: new Set(graphSkillIds.filter((skillId) => !keptIds.has(skillId))),
    }),
  ];

  return {
    graphSkillIds,
    keptSkills: skills.map(({ courseIds, skillId }) => ({ courseIds, skillId })),
    lessons,
    unwritten: listUnwritten({ entries: kept, lessons }),
  };
}
