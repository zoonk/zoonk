import { type PlanOperation } from "../../plan-contract";
import { daysBetween } from "../../planner/plan-calendar";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import {
  findLastDue,
  getAreaOf,
  getRuleItemKey,
  isDueOn,
  isTodoLesson,
  sumTodoLessons,
  toDay,
} from "./rule-items";

/** A test this many days away or closer is planned day by day: a focus orders its review. */
const REVIEW_DAYS = 7;

/** What a focus asks more of: an area, or the part of one the learner named. */
type FocusTarget = { area: string; name: string; skillIds: ReadonlySet<string> };

/** A change that only says where to put more or less time (a focus, less of an area). */
function isSteeringOnly(operations: readonly PlanOperation[]): boolean {
  return (
    operations.length > 0 &&
    operations.every(
      (operation) => operation.kind === "focusAreas" || operation.kind === "reduceAreas",
    )
  );
}

/** A test days away: a focus orders its review day instead of its lessons (see `findReviewAhead`). */
function hasReviewAhead({ after, today }: Pick<RuleContext, "after" | "today">): boolean {
  const { kind, targetDate } = after.goal;
  return kind === "exam" && targetDate !== null && daysBetween(today, targetDate) <= REVIEW_DAYS;
}

/** The steering change of a step, when the learner made one. */
function getSteering(context: RuleContext): readonly PlanOperation[] | null {
  const { before, event } = context;

  if (!before || event.kind !== "learnerChange" || !isSteeringOnly(event.operations)) {
    return null;
  }

  return hasReviewAhead(context) ? null : event.operations;
}

function listAreaSkills({ area, plan }: { area: string; plan: RulePlan }): Set<string> {
  const areaOf = getAreaOf(plan.graph);

  return new Set(
    plan.graph.skills.flatMap((skill) => (areaOf(skill.skillId) === area ? skill.skillId : [])),
  );
}

/** Each area a focus names, or the part of it the change (or the plan) narrows it to. */
function listFocusTargets({
  operations,
  plan,
}: {
  operations: readonly PlanOperation[];
  plan: RulePlan;
}): FocusTarget[] {
  return operations.flatMap((operation) => {
    if (operation.kind !== "focusAreas") {
      return [];
    }

    return operation.areas.map((area) => {
      const part =
        operation.parts?.find((entry) => entry.area === area) ??
        plan.settings.focusParts.find((entry) => entry.area === area);

      return part
        ? { area, name: part.name, skillIds: new Set(part.skillIds) }
        : { area, name: area, skillIds: listAreaSkills({ area, plan }) };
    });
  });
}

function listReducedAreas(operations: readonly PlanOperation[]): string[] {
  return operations.flatMap((operation) =>
    operation.kind === "reduceAreas" ? operation.areas : [],
  );
}

/** The lessons still to do of some skills, and the day the last of them is due. */
function readSkills({
  items,
  skillIds,
}: {
  items: readonly RuleItem[];
  skillIds: ReadonlySet<string>;
}) {
  const own = items.filter((item) => isTodoLesson(item) && skillIds.has(item.skillId ?? ""));
  return { last: findLastDue(own), lessons: sumTodoLessons(own) };
}

function compareSkills({
  context,
  skillIds,
}: {
  context: { after: RulePlan; before: RulePlan };
  skillIds: ReadonlySet<string>;
}) {
  const was = readSkills({ items: context.before.items, skillIds });
  const now = readSkills({ items: context.after.items, skillIds });

  return {
    delta: now.lessons - was.lessons,
    details: {
      lastAfter: toDay(now.last),
      lastBefore: toDay(was.last),
      lessonsAfter: now.lessons,
      lessonsBefore: was.lessons,
    },
    endsLater: now.lessons === was.lessons && (now.last ?? 0) > (was.last ?? 0),
    loses: now.lessons < was.lessons,
  };
}

/** The card of the change the learner applied, and the areas of the lessons it lists as leaving. */
function readAppliedCard({ before, context }: { before: RulePlan; context: RuleContext }) {
  const effect = context.changes?.find((change) => change.status === "applied")?.effect ?? null;
  const areaOf = getAreaOf(before.graph);
  const leaving = new Set(effect?.lessonsLeftOut);

  const leavingAreas = before.items.flatMap((item) =>
    isTodoLesson(item) && leaving.has(item.titleSnapshot) ? (areaOf(item.skillId) ?? []) : [],
  );

  return { effect, leavingAreas };
}

/**
 * The areas the applied change's card says give something: with fewer lessons still to do (an
 * `areaLessons` line, a lesson of theirs left out, or their topics left out), or with as many done
 * later (an `areaEnds` line).
 */
function listGivingOnCard({ before, context }: { before: RulePlan; context: RuleContext }) {
  const { effect, leavingAreas } = readAppliedCard({ before, context });

  const fewer = new Set([
    ...(effect?.areaLessons ?? []).map((lessons) => lessons.area),
    ...(effect?.topicsLeftOut ?? []).map((entry) => entry.area),
    ...leavingAreas,
  ]);

  return { fewer, later: new Set((effect?.areaEnds ?? []).map((end) => end.area)) };
}

/**
 * R1. A focus never shrinks the focused area: after a change that only steers (a focus, less of
 * an area), each focused area (or the part named) has at least as many lessons still to do as the
 * plan the learner saw, and with as many, its last one is due no later. When the change adds areas
 * to the focus, an area focused before may share with them, as long as the card says what it gives
 * (Ana's "math and natural sciences": refused because math would give some depth, it showed
 * "Nothing changed" though natural sciences gained 10 lessons).
 */
export function checkFocusKeepsArea(context: RuleContext): RuleViolation[] {
  const operations = getSteering(context);
  const { after, before } = context;

  if (!operations || !before) {
    return [];
  }

  const targets = listFocusTargets({ operations, plan: after });
  const focusedBefore = new Set(before.settings.focusAreas);
  const addsAreas = targets.some((target) => !focusedBefore.has(target.area));
  const giving = listGivingOnCard({ before, context });

  return targets.flatMap((target) => {
    const result = compareSkills({ context: { after, before }, skillIds: target.skillIds });
    const shares = addsAreas && focusedBefore.has(target.area);
    const said = result.loses ? giving.fewer.has(target.area) : giving.later.has(target.area);

    return (result.loses || result.endsLater) && !(shares && said)
      ? [
          {
            details: { area: target.name, ...result.details },
            message: `The focus on ${target.name} left it with less: fewer lessons, or as many done later.`,
            rule: "R1",
          },
        ]
      : [];
  });
}

/** Every area of a plan's graph. */
function listAreas(plan: RulePlan): string[] {
  const areaOf = getAreaOf(plan.graph);
  return [...new Set(plan.graph.skills.flatMap((skill) => areaOf(skill.skillId) ?? []))];
}

/** Lessons an area a change doesn't name may move by: rounding, not something to say (D5). */
const ROUNDING_LESSONS = 2;

/**
 * The areas the card of the change the learner applied names: whose start, end or lessons still to
 * do it gives, whose topics it brings in or leaves out, and those of the lessons it lists as leaving.
 */
function listCardAreas({ before, context }: { before: RulePlan; context: RuleContext }) {
  const { effect, leavingAreas } = readAppliedCard({ before, context });

  return new Set([
    ...(effect?.areaEnds ?? []).map((end) => end.area),
    ...(effect?.areaLessons ?? []).map((lessons) => lessons.area),
    ...(effect?.areaStarts ?? []).map((start) => start.area),
    ...[...(effect?.topicsAdded ?? []), ...(effect?.topicsLeftOut ?? [])].map(
      (entry) => entry.area,
    ),
    ...leavingAreas,
  ]);
}

/**
 * The areas the applied change's card says keep all their lessons and their end date: an
 * `areaEnds` entry whose day doesn't move ("less of an area" while everything still fits).
 */
function listKeptOnCard(context: RuleContext): Set<string> {
  const effect = context.changes?.find((change) => change.status === "applied")?.effect ?? null;

  return new Set(
    (effect?.areaEnds ?? []).filter((end) => end.after === end.before).map((end) => end.area),
  );
}

/**
 * R2. Less of an area takes from that area: after a change that only steers and names areas to
 * reduce, each reduced area has fewer lessons still to do, or as many due later, or the card says
 * it keeps all its lessons and its end date because everything fits (an `areaEnds` entry with the
 * same day before and after; the stored "less" applies once time gets short). An area with no
 * lesson left to do has nothing to give. An area the change doesn't name moves only by rounding
 * (at most two lessons; with "less" alone, it may gain the time freed) unless the card names it.
 */
export function checkReduceTakesFromArea(context: RuleContext): RuleViolation[] {
  const operations = getSteering(context);
  const { after, before } = context;
  const reduced = operations ? listReducedAreas(operations) : [];

  if (!operations || !before || reduced.length === 0) {
    return [];
  }

  const plans = { after, before };

  const compareArea = (area: string) =>
    compareSkills({ context: plans, skillIds: listAreaSkills({ area, plan: after }) });

  const keptOnCard = listKeptOnCard(context);

  const unmoved = reduced.flatMap((area) => {
    const result = compareArea(area);
    const empty = result.details.lessonsBefore === 0;
    const took = result.loses || result.endsLater || keptOnCard.has(area);
    return took || empty ? [] : [{ area, ...result.details }];
  });

  const focused = listFocusTargets({ operations, plan: after });
  const named = new Set([...reduced, ...focused.map((target) => target.name)]);
  const onCard = listCardAreas({ before, context });

  const moved = listAreas(after)
    .filter((area) => !named.has(area) && !onCard.has(area))
    .flatMap((area) => {
      const { delta, details } = compareArea(area);
      const beyond = focused.length > 0 ? Math.abs(delta) : -delta;
      return beyond > ROUNDING_LESSONS ? [{ area, ...details }] : [];
    });

  return [
    ...unmoved.map((details) => ({
      details,
      message: `Less of ${details.area} neither took lessons from it nor moved its end later.`,
      rule: "R2",
    })),
    ...moved.map((details) => ({
      details,
      message: `The change moved ${details.area}, which it doesn't name, by more than rounding, and the card doesn't say it.`,
      rule: "R2",
    })),
  ];
}

/** Today's lessons still to do, by their identity, in the plan's order. */
function listTodayLessons({ day, items }: { day: Date; items: readonly RuleItem[] }) {
  return items.filter((item) => isTodoLesson(item) && isDueOn({ day, item }));
}

/** The keys of some items, in order. */
function toKeys(items: readonly RuleItem[]): string[] {
  return items.map((item) => getRuleItemKey(item));
}

/**
 * R4. A change of where to focus keeps today's session as the learner saw it: its lessons stay, in
 * their order, but those of the areas it gives less time to; lessons that come in are the focused
 * ones, after them. No lesson of an area the change doesn't name comes in. With "less" alone, the
 * time it frees today may go to the lessons next in the plan, after today's, as R2 lets unnamed
 * areas gain it; never to the reduced areas.
 */
export function checkSteeringKeepsToday(context: RuleContext): RuleViolation[] {
  const operations = getSteering(context);
  const { after, before, today, todayShown } = context;

  if (!operations || !before || !todayShown) {
    return [];
  }

  const areaOf = getAreaOf(after.graph);
  const reduced = new Set(listReducedAreas(operations));
  const focused = listFocusTargets({ operations, plan: after });
  const was = listTodayLessons({ day: today, items: before.items });
  const now = listTodayLessons({ day: today, items: after.items });
  const nowKeys = toKeys(now);
  const kept = toKeys(was.filter((item) => !reduced.has(areaOf(item.skillId) ?? "")));
  const wasKeys = new Set(toKeys(was));
  const lastKept = nowKeys.findLastIndex((key) => kept.includes(key));

  const came = now.filter((item) => !wasKeys.has(getRuleItemKey(item)));

  const mayComeIn = (item: RuleItem) =>
    focused.length > 0
      ? focused.some((target) => target.skillIds.has(item.skillId ?? ""))
      : !reduced.has(areaOf(item.skillId) ?? "");

  const inOrder =
    nowKeys.filter((key) => kept.includes(key)).join(",") ===
    kept.filter((key) => nowKeys.includes(key)).join(",");

  const problems = [
    ...kept
      .filter((key) => !nowKeys.includes(key))
      .map((lesson) => ({ lesson, problem: "left today" })),
    ...(inOrder ? [] : [{ lesson: null, problem: "reordered" }]),
    ...came
      .filter((item) => !mayComeIn(item))
      .map((item) => ({
        lesson: item.titleSnapshot,
        problem: `came in from ${areaOf(item.skillId) ?? "an unnamed area"}`,
      })),
    ...came
      .filter((item) => mayComeIn(item) && now.indexOf(item) < lastKept)
      .map((item) => ({ lesson: item.titleSnapshot, problem: "came in before today's lessons" })),
  ];

  return problems.map((details) => ({
    details,
    message: "A change of focus changed today's session beyond what it asked.",
    rule: "R4",
  }));
}
