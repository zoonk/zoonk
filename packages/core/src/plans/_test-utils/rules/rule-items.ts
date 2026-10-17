import { isDeepStrictEqual } from "node:util";
import { toTopicKey } from "../../../library/exams/topic-key";
import { countItemLessons } from "../../_utils/stand-in-lessons";
import { type PlanChangeView } from "../../plan-view-contract";
import { getFoundationSkillIds, getSkillArea } from "../../planner/graph-areas";
import { toIsoDate } from "../../planner/plan-calendar";
import { type PlanGraph, type PlanGraphSkill } from "../../planner/plan-state";
import { getBossKey } from "../../planner/plan-units";
import { type RuleContext, type RuleItem, type RulePlan } from "./rule-context";

/** Each item of a plan as one line: its key, its day and its status. */
function describeItems(plan: RulePlan): string[] {
  return plan.items
    .map((item) => `${getRuleItemKey(item)}|${item.scheduledFor?.getTime()}|${item.status}`)
    .toSorted();
}

/** Whether a step left every item as it was, on its day and with its status: nothing ran. */
export function isPlanUnchanged({ after, before }: { after: RulePlan; before: RulePlan }): boolean {
  return isDeepStrictEqual(describeItems(after), describeItems(before));
}

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

/** How many lessons an item is: one, or a stand-in's saved size (see `countItemLessons`). */
function countLessons(item: RuleItem): number {
  return countItemLessons(item);
}

/** The lessons still to do among these items. */
export function sumTodoLessons(items: readonly RuleItem[]): number {
  return items
    .filter((item) => isTodoLesson(item))
    .reduce((sum, item) => sum + countLessons(item), 0);
}

/** Each skill's lessons still to do. */
export function countSkillLessons(items: readonly RuleItem[]): Map<string, number> {
  return items
    .filter((item) => isTodoLesson(item) && item.skillId !== null)
    .reduce(
      (skills, item) =>
        skills.set(item.skillId ?? "", (skills.get(item.skillId ?? "") ?? 0) + countLessons(item)),
      new Map<string, number>(),
    );
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

/** A notice topic of one area: the key two plans compare it by. */
export function toAreaTopicKey({ area, topic }: { area: string; topic: string }): string {
  return `${area}|${toTopicKey(topic)}`;
}

/**
 * The topics a skill teaches as plan changes name them: its notice topics, or its own name when
 * the graph maps no topics at all (a career's, a language's), as the planner's `listPlannedTopics`
 * reads it.
 */
export function getSkillTopics(graph: PlanGraph): (skill: PlanGraphSkill) => readonly string[] {
  const mapsTopics = graph.skills.some((skill) => (skill.topics ?? []).length > 0);
  return (skill) => (mapsTopics ? (skill.topics ?? []) : [skill.name]);
}

/**
 * The topics a plan teaches, by area: a topic is in while any skill that teaches it has an item in
 * the plan that isn't set aside for time (`skipped`), done and tested out included (as the
 * planner's `listPlannedTopics` reads it). A graph without notice topics names its skills (see
 * `getSkillTopics`).
 */
export function listPlannedTopics(plan: Pick<RulePlan, "graph" | "items">): Map<string, string> {
  const planned = new Set(
    plan.items.flatMap((item) => (item.status === "skipped" ? [] : (item.skillId ?? []))),
  );

  const topicsOf = getSkillTopics(plan.graph);

  return new Map(
    plan.graph.skills
      .filter((skill) => planned.has(skill.skillId))
      .flatMap((skill) => {
        const area = getSkillArea({ graph: plan.graph, skill });
        return topicsOf(skill).map((topic) => [toAreaTopicKey({ area, topic }), topic]);
      }),
  );
}

/** The skills a plan has lessons for, done, tested out or still to do; set aside ones are out. */
export function listPlannedSkills(items: readonly RuleItem[]): Set<string> {
  return new Set(
    items.flatMap((item) =>
      item.kind === "lesson" && item.skillId && item.status !== "skipped" ? [item.skillId] : [],
    ),
  );
}

/** The keys in `from` that `to` doesn't have. */
export function listMissingKeys<T>({
  from,
  to,
}: {
  from: ReadonlyMap<string, T>;
  to: ReadonlyMap<string, T>;
}): string[] {
  return [...from.keys()].filter((key) => !to.has(key));
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

/**
 * Today's proposals to move the phase dates (`fitPhaseDates`) that start from the ends the learner
 * sees: waiting after the step, or declined ("Keep mine", which the planner honors while those are
 * the ends shown). A system run never moves a shown end, so while one waits, what moving them would
 * fix may stay as the card says; "Keep mine" is the learner's informed choice, like one out by
 * choice.
 */
export function listPhaseDatesProposals(context: RuleContext): PlanChangeView[] {
  const { after, declined = [], waiting = [] } = context;

  return [...waiting, ...declined].filter(
    (change) =>
      change.operations.some((operation) => operation.kind === "fitPhaseDates") &&
      (change.effect?.phaseEnds ?? []).every((move) =>
        after.phases.some((phase) => phase.name === move.name && phase.endDate === move.before),
      ),
  );
}

/**
 * Each skill's lessons as the plan's last build counted them (`plannedLessons`, written by the
 * planner, `withPlannedLessons`), which size its core for the plan, its challenges and the checks
 * alike (`listCoreLessonItems` reads them the same way); the graph's estimate for a plan saved
 * before builds counted them (career seed 2050: the graph guessed 7 for a skill
 * whose chapter has 6).
 */
export function listSkillSizes(plan: RulePlan): Map<string, number> {
  return new Map(
    plan.graph.skills.map((skill) => [skill.skillId, skill.plannedLessons ?? skill.lessons]),
  );
}

/**
 * Whether an item is a phase's challenge held on the end the learner saw while a proposal to move
 * that end waits, or after the learner kept their dates on a card that told them why it moves
 * (`reason`: a challenge resting there, or lessons it tests coming after it), as the planner reads
 * "Keep mine" (`isKeptOver`). See `listPhaseDatesProposals`.
 */
export function isHeldOnShownEnd({
  context,
  item,
  reason,
}: {
  context: RuleContext;
  item: RuleItem;
  reason: "lessonsFirst" | "restDay";
}): boolean {
  const end = context.after.phases[item.phase ?? -1]?.endDate;
  const waiting = new Set(context.waiting);

  return (
    item.kind === "boss" &&
    end !== undefined &&
    end !== null &&
    item.scheduledFor !== null &&
    toIsoDate(item.scheduledFor) === end &&
    listPhaseDatesProposals(context).some((change) =>
      (change.effect?.phaseEnds ?? []).some(
        (move) => move.before === end && (waiting.has(change) || move[reason] === true),
      ),
    )
  );
}
