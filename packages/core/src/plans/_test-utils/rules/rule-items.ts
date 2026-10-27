import { getFoundationSkillIds, getSkillArea } from "../../planner/graph-areas";
import { toIsoDate } from "../../planner/plan-calendar";
import { type PlanGraph } from "../../planner/plan-state";
import { getBossKey } from "../../planner/plan-units";
import { type RuleItem, type RulePlan } from "./rule-context";

/** Each skill's area, as plan changes name areas (see `getSkillArea`). */
export function getAreaOf(graph: PlanGraph): (skillId: string | null) => string | null {
  const areas = new Map(
    graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]),
  );

  return function areaOf(skillId) {
    return skillId === null ? null : (areas.get(skillId) ?? null);
  };
}

/** A lesson the learner still has to study. */
export function isTodoLesson(item: RuleItem): boolean {
  return item.kind === "lesson" && item.status === "todo";
}

/** The day an item is due, as a time; null without one. */
function getDueTime(item: RuleItem): number | null {
  return item.scheduledFor?.getTime() ?? null;
}

/** When the first of these items is due; null when none has a day. */
export function findFirstDue(items: readonly RuleItem[]): number | null {
  const times = items.flatMap((item) => getDueTime(item) ?? []);
  return times.length > 0 ? Math.min(...times) : null;
}

/** When the last of these items is due; null when none has a day. */
export function findLastDue(items: readonly RuleItem[]): number | null {
  const times = items.flatMap((item) => getDueTime(item) ?? []);
  return times.length > 0 ? Math.max(...times) : null;
}

/** A due time as the ISO day screens show; null stays null. */
export function toDay(time: number | null): string | null {
  return time === null ? null : toIsoDate(new Date(time));
}

/** Whether an item is due on a given day. */
export function isDueOn({ day, item }: { day: Date; item: RuleItem }): boolean {
  return item.scheduledFor?.getTime() === day.getTime();
}

/**
 * An item's identity across two plans, as the planner's `getItemKey` reads it: its lesson, else its
 * skill's stand-in, a boss by its phase, a chapter by its chapter, else its kind and day.
 */
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

/**
 * The skills the learner chose to pass over: bases they chose to skip ("Skip") and the basics of
 * areas they said are too basic (`setAreaStart` with `pastBasics`: the areas' foundations, see
 * `getFoundationSkillIds`), including an exam's listening areas onboarding sets past the basics for
 * a stated intermediate or advanced level or listening ticked as known, and placement for a level
 * its text answers confirm. Both are explicit choices, so their lessons may leave at once, but the
 * skills stay "to confirm": practice asks them and a miss brings their lessons back (RULES 4).
 */
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

/**
 * The skills a plan leaves out by the learner's explicit choice, not for lack of time: areas they
 * took out, bases they chose to skip ("Skip") and the basics of areas they said are too basic.
 * Nothing else they only said they know (a subject, their level) leaves without its own answers
 * (D9).
 */
export function listOutByChoice(plan: RulePlan): Set<string> {
  return new Set([...listTakenOut(plan), ...listChosenToPassOver(plan)]);
}

/**
 * The skills of areas the learner took out (`skipAreas`): the learner's to leave, so they stay out
 * whatever happens, practice and a miss included.
 */
function listTakenOut(plan: RulePlan): Set<string> {
  const areaOf = getAreaOf(plan.graph);

  return new Set(
    plan.graph.skills
      .map((skill) => skill.skillId)
      .filter((skillId) => plan.settings.skippedAreas.includes(areaOf(skillId) ?? "")),
  );
}
