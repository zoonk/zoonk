import { isDeepStrictEqual } from "node:util";
import { type PlanEffect } from "../../planner/plan-effect";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import {
  countSkillLessons,
  findFirstDue,
  findLastDue,
  isTodoLesson,
  listMissingKeys,
  listPlannedSkills,
  listPlannedTopics,
  toAreaTopicKey,
  toDay,
} from "./rule-items";
import { listAreaSkills, listFocusTargets, listReducedAreas } from "./steering-rules";

/** One claim of a card and what the saved plans say instead. */
type Mismatch = { card: unknown; field: string; plan: unknown };

/** The lessons `from` has more of than `to`, skill by skill. */
function countGained({ from, to }: { from: Map<string, number>; to: Map<string, number> }) {
  return [...from].reduce(
    (total, [skillId, lessons]) => total + Math.max(0, lessons - (to.get(skillId) ?? 0)),
    0,
  );
}

/**
 * The lessons of the plan the learner saw that leave it whole, by title: a lesson the new plan
 * doesn't have or sets aside for time, and a stand-in whose skill has no lesson left in it.
 */
function listLessonsLeftOut({ after, before }: { after: RulePlan; before: RulePlan }): string[] {
  const lessonIds = new Set(
    after.items.flatMap((item) => (item.status === "skipped" ? [] : (item.lessonId ?? []))),
  );

  const skillIds = listPlannedSkills(after.items);

  return before.items
    .filter((item) => isTodoLesson(item))
    .filter((item) =>
      item.lessonId ? !lessonIds.has(item.lessonId) : !skillIds.has(item.skillId ?? ""),
    )
    .map((item) => item.titleSnapshot)
    .toSorted();
}

function toTopicKeys(topics: PlanEffect["topicsLeftOut"]): string[] {
  return (topics ?? [])
    .flatMap(({ area, topics: names }) => names.map((topic) => toAreaTopicKey({ area, topic })))
    .toSorted();
}

/**
 * The new plan's items with each lesson the plan the learner saw holds filed under the skill they
 * saw it under: a lesson two skills share, filed under the other one, is the same lesson, neither
 * added nor left out (Câmara seed 2009; the planner's `countLessonChanges`).
 */
function fileAsSeen({ after, before }: { after: RulePlan; before: RulePlan }): RuleItem[] {
  const seen = new Map(
    before.items.flatMap((item) => (item.lessonId ? [[item.lessonId, item.skillId] as const] : [])),
  );

  return after.items.map((item) =>
    item.lessonId && seen.has(item.lessonId)
      ? { ...item, skillId: seen.get(item.lessonId) ?? item.skillId }
      : item,
  );
}

/** What the change did to the plan the learner saw, read from the two saved plans. */
function diffPlans({ after, before }: { after: RulePlan; before: RulePlan }) {
  const was = countSkillLessons(before.items);
  const now = countSkillLessons(fileAsSeen({ after, before }));
  const [topicsBefore, topicsAfter] = [listPlannedTopics(before), listPlannedTopics(after)];

  return {
    lessonsAdded: countGained({ from: now, to: was }),
    lessonsLeftOut: listLessonsLeftOut({ after, before }),
    lessonsRemoved: countGained({ from: was, to: now }),
    topicsAdded: listMissingKeys({ from: topicsAfter, to: topicsBefore }).toSorted(),
    topicsLeftOut: listMissingKeys({ from: topicsBefore, to: topicsAfter }).toSorted(),
  };
}

function compare({ card, field, plan }: Mismatch): Mismatch[] {
  return isDeepStrictEqual(card, plan) ? [] : [{ card, field, plan }];
}

/** The lessons still to do of some skills. */
function listTodo({ items, skillIds }: { items: readonly RuleItem[]; skillIds: Set<string> }) {
  return items.filter((item) => isTodoLesson(item) && skillIds.has(item.skillId ?? ""));
}

/** The areas a steering change names, each with its skills, as the card names them. */
function listSteered({ context, plan }: { context: RuleContext; plan: RulePlan }) {
  const operations = context.event.kind === "learnerChange" ? context.event.operations : [];

  return [
    ...listFocusTargets({ operations, plan }),
    ...listReducedAreas(operations).map((area) => ({
      name: area,
      skillIds: listAreaSkills({ area, plan }),
    })),
  ].map((target) => ({ name: target.name, skillIds: new Set(target.skillIds) }));
}

/**
 * Each area end and start the card gives against the saved plans, and every steered area whose end
 * moved that the card leaves out.
 */
function compareAreaDates({
  after,
  before,
  context,
  effect,
}: {
  after: RulePlan;
  before: RulePlan;
  context: RuleContext;
  effect: PlanEffect;
}): Mismatch[] {
  const steered = listSteered({ context, plan: after });

  const readArea = (name: string) => {
    const skillIds = steered.find((target) => target.name === name)?.skillIds ?? new Set<string>();

    const [was, now] = [
      listTodo({ items: before.items, skillIds }),
      listTodo({ items: after.items, skillIds }),
    ];

    return {
      ends: { after: toDay(findLastDue(now)), before: toDay(findLastDue(was)) },
      starts: { after: toDay(findFirstDue(now)), before: toDay(findFirstDue(was)) },
    };
  };

  const listed = new Set((effect.areaEnds ?? []).map((end) => end.area));

  return [
    ...(effect.areaEnds ?? []).flatMap((end) =>
      compare({
        card: { after: end.after, before: end.before },
        field: `areaEnds:${end.area}`,
        plan: readArea(end.area).ends,
      }),
    ),
    ...(effect.areaStarts ?? []).flatMap((start) =>
      compare({
        card: { after: start.after, before: start.before },
        field: `areaStarts:${start.area}`,
        plan: readArea(start.area).starts,
      }),
    ),
    ...steered.flatMap(({ name }) => {
      const { ends } = readArea(name);
      const moved = ends.after !== null && ends.before !== null && ends.after !== ends.before;

      return moved && !listed.has(name)
        ? [{ card: null, field: `areaEnds:${name}`, plan: ends }]
        : [];
    }),
  ];
}

/**
 * Each unnamed area's lessons still to do the card gives (`areaLessons`, D5's line for an area that
 * moved by more than rounding) against the saved plans; a stand-in counts as its saved lessons.
 */
function compareAreaLessons({
  after,
  before,
  effect,
}: {
  after: RulePlan;
  before: RulePlan;
  effect: PlanEffect;
}): Mismatch[] {
  const [was, now] = [countSkillLessons(before.items), countSkillLessons(after.items)];

  const count = ({ area, lessons }: { area: string; lessons: Map<string, number> }) =>
    [...listAreaSkills({ area, plan: after })].reduce(
      (sum, skillId) => sum + (lessons.get(skillId) ?? 0),
      0,
    );

  return (effect.areaLessons ?? []).flatMap((entry) =>
    compare({
      card: { after: entry.after, before: entry.before },
      field: `areaLessons:${entry.area}`,
      plan: {
        after: count({ area: entry.area, lessons: now }),
        before: count({ area: entry.area, lessons: was }),
      },
    }),
  );
}

/** The day the first lesson of the skills a change adds is due in the saved plan. */
function getAddedStart({ after, context }: { after: RulePlan; context: RuleContext }) {
  const operations = context.event.kind === "learnerChange" ? context.event.operations : [];

  const skillIds = new Set(
    operations.flatMap((operation) =>
      operation.kind === "addSkills" ? operation.skills.map((skill) => skill.skillId) : [],
    ),
  );

  return skillIds.size > 0 ? toDay(findFirstDue(listTodo({ items: after.items, skillIds }))) : null;
}

/**
 * R3. A card says what the change did to the plan the learner saw: the lessons it adds and removes
 * skill by skill, the lessons it leaves out whole, the notice topics it brings in or leaves out,
 * when each area it steers starts and ends, how many lessons an unnamed area it moves keeps, and
 * when added topics start, all read from the saved plan before the change and the one saved after.
 */
export function checkCardMatchesPlan(context: RuleContext): RuleViolation[] {
  const { after, before, changes, event } = context;
  const change = changes?.find((entry) => entry.status === "applied" && entry.effect);

  if (!before || event.kind !== "learnerChange" || !change?.effect) {
    return [];
  }

  const effect = change.effect;
  const truth = diffPlans({ after, before });
  const addedStart = getAddedStart({ after, context });

  const mismatches = [
    ...compare({ card: effect.lessonsAdded, field: "lessonsAdded", plan: truth.lessonsAdded }),
    ...compare({
      card: effect.lessonsRemoved,
      field: "lessonsRemoved",
      plan: truth.lessonsRemoved,
    }),
    ...compare({
      card: (effect.lessonsLeftOut ?? []).toSorted(),
      field: "lessonsLeftOut",
      plan: truth.lessonsLeftOut,
    }),
    ...compare({
      card: toTopicKeys(effect.topicsAdded),
      field: "topicsAdded",
      plan: truth.topicsAdded,
    }),
    ...compare({
      card: toTopicKeys(effect.topicsLeftOut),
      field: "topicsLeftOut",
      plan: truth.topicsLeftOut,
    }),
    ...(addedStart
      ? compare({
          card: effect.addedTopicsStart ?? null,
          field: "addedTopicsStart",
          plan: addedStart,
        })
      : []),
    ...compareAreaDates({ after, before, context, effect }),
    ...compareAreaLessons({ after, before, effect }),
  ];

  return mismatches.map((mismatch) => ({
    details: { changeId: change.id, ...mismatch },
    message: `The card's ${mismatch.field} isn't what the saved plan shows.`,
    rule: "R3",
  }));
}
