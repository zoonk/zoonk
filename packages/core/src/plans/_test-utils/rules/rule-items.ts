import { getFoundationSkillIds, getSkillArea } from "../../planner/graph-areas";
import { toIsoDate } from "../../planner/plan-calendar";
import { type PlanGraph } from "../../planner/plan-state";
import { getBossKey } from "../../planner/plan-units";
import { type RuleItem, type RulePlan } from "./rule-context";

export function getAreaOf(graph: PlanGraph): (skillId: string | null) => string | null {
  const areas = new Map(
    graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

  return function areaOf(skillId) {
    return skillId === null ? null : (areas.get(skillId) ?? null);
  };
}

export function isTodoLesson(item: RuleItem): boolean {
  return item.kind === "lesson" && item.status === "todo";
}

function getDueTime(item: RuleItem): number | null {
  return item.scheduledFor?.getTime() ?? null;
}

export function findFirstDue(items: readonly RuleItem[]): number | null {
  const times = items.flatMap((item) => getDueTime(item) ?? []);
  return times.length > 0 ? Math.min(...times) : null;
}

export function findLastDue(items: readonly RuleItem[]): number | null {
  const times = items.flatMap((item) => getDueTime(item) ?? []);
  return times.length > 0 ? Math.max(...times) : null;
}

export function toDay(time: number | null): string | null {
  return time === null ? null : toIsoDate(new Date(time));
}

export function isDueOn({ day, item }: { day: Date; item: RuleItem }): boolean {
  return item.scheduledFor?.getTime() === day.getTime();
}

export function getRuleItemKey(item: RuleItem): string {
  if (item.lessonId) {
    return `lesson:${item.lessonId}`;
  }

  if (item.kind === "lesson" && item.skillId) {
    return `skill:${item.skillId}`;
  }

  if (item.kind === "boss") {
    return getBossKey(item.phase);
  }

  if (item.kind === "chapter" && item.chapterId) {
    return `chapter:${item.chapterId}`;
  }

  return `${item.kind}:${toDay(item.scheduledFor?.getTime() ?? null) ?? item.titleSnapshot}`;
}

function listChosenToPassOver(plan: RulePlan): Set<string> {
  const { graph, prerequisites, settings } = plan;
  const areaOf = getAreaOf(graph);
  const foundations = getFoundationSkillIds({ graph, prerequisites: prerequisites ?? new Map() });

  return new Set(
    graph.skills
      .map((skill) => skill.skillId)
      .filter(
        (skillId) =>
          settings.baseChoices.some((base) => base.skillId === skillId && base.choice === "skip") ||
          (foundations.has(skillId) && settings.pastBasicsAreas.includes(areaOf(skillId) ?? "")),
      ),
  );
}

export function listOutByChoice(plan: RulePlan): Set<string> {
  return new Set([...listTakenOut(plan), ...listChosenToPassOver(plan)]);
}

function listTakenOut(plan: RulePlan): Set<string> {
  const areaOf = getAreaOf(plan.graph);

  return new Set(
    plan.graph.skills
      .map((skill) => skill.skillId)
      .filter((skillId) => plan.settings.skippedAreas.includes(areaOf(skillId) ?? "")),
  );
}
