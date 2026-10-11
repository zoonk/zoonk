import {
  type RuleContext,
  type RuleEvent,
  type RuleItem,
  type RulePlan,
  type RuleViolation,
} from "./rule-context";
import {
  describeItem,
  getRuleItemKey,
  isDueOn,
  isTodoLesson,
  listMissingItems,
  listMissingKeys,
  listPlannedTopics,
  toAreaTopicKey,
  toDay,
} from "./rule-items";

/** Steps the learner didn't ask for: the plan may only follow what it learned on its own. */
const SYSTEM_EVENTS = new Set<RuleEvent["kind"]>(["outlinesLanded", "refresh"]);

/** Steps whose planning keeps the phase ends the learner saw (a refresh, a session, a studied day). */
function keepsPhaseEnds(event: RuleEvent): boolean {
  return (
    SYSTEM_EVENTS.has(event.kind) ||
    event.kind === "session" ||
    (event.kind === "newDay" && event.studied)
  );
}

/** The topics the step's recorded changes name, as left out and as added. */
function listSaidTopics(context: RuleContext) {
  const effects = (context.changes ?? []).flatMap((change) => change.effect ?? []);

  const keys = (field: "topicsAdded" | "topicsLeftOut") =>
    new Set(
      effects.flatMap((effect) =>
        (effect[field] ?? []).flatMap(({ area, topics }) =>
          topics.map((topic) => toAreaTopicKey({ area, topic })),
        ),
      ),
    );

  return { added: keys("topicsAdded"), leftOut: keys("topicsLeftOut") };
}

/** A learner's change whose card R3 already compares with the saved plans. */
function hasAppliedCard(context: RuleContext): boolean {
  return (
    context.event.kind === "learnerChange" &&
    (context.changes ?? []).some((change) => change.status === "applied" && change.effect)
  );
}

/**
 * R5. Every change is recorded and said: any step (placement, a session, a new day, a refresh, a
 * learner's change) that changes which notice topics the plan teaches records a change naming
 * each topic that leaves or comes in, a missed day's included (saying the plan covers less isn't
 * naming them). A goal whose graph maps no notice topics names the skills instead (see
 * `getSkillTopics`). A learner's change with a card is R3's. A tested-out item keeps a topic in
 * the plan but never brings one in: a skill out for time that a right answer settles gets a
 * tested-out stand-in so no re-plan brings it back, and its test-out announces that.
 */
export function checkChangesSaid(context: RuleContext): RuleViolation[] {
  const { after, before, event } = context;

  // An undo takes back what its change's card named; R38 checks it gives that plan back. The
  // editor's Undo of the latest edit (`setBack`) is one too.
  if (
    !before ||
    hasAppliedCard(context) ||
    ["accountDeleted", "planCreated", "promptChanged", "undo"].includes(event.kind) ||
    (event.kind === "learnerChange" && event.setBack)
  ) {
    return [];
  }

  const [was, now] = [listPlannedTopics(before), listPlannedTopics(after)];
  const said = listSaidTopics(context);

  const taught = listPlannedTopics({
    ...after,
    items: after.items.filter((item) => item.status !== "testedOut"),
  });

  const leftOut = listMissingKeys({ from: was, to: now }).filter((key) => !said.leftOut.has(key));

  const added = listMissingKeys({ from: taught, to: was }).filter((key) => !said.added.has(key));

  return [
    ...(leftOut.length > 0
      ? [
          {
            details: { topics: leftOut },
            message: "Topics left the plan without a change saying so.",
            rule: "R5",
          },
        ]
      : []),
    ...(added.length > 0
      ? [
          {
            details: { topics: added },
            message: "Topics came into the plan without a change saying so.",
            rule: "R5",
          },
        ]
      : []),
  ];
}

/**
 * Whether the learner finished a phase: it has items and none is still to do. It shows the days it
 * was finished on, wherever they fall (R39).
 */
function isPhaseFinished({ index, plan }: { index: number; plan: RulePlan }): boolean {
  const own = plan.items.filter((item) => item.phase === index);
  return own.length > 0 && own.every((item) => item.status !== "todo");
}

/**
 * A learn plan's last phase with dates, whose end is the goal's finish. A phase the learner
 * finished isn't the finish: language seed 2011 tested out a later phase in a session, and the
 * phase before it still ended with the plan.
 */
function findLastDatedPhase(plan: RulePlan): number {
  return plan.phases.findLastIndex(
    (phase, index) => phase.endDate !== null && !isPhaseFinished({ index, plan }),
  );
}

/**
 * R6. Phase ends the learner saw don't move through system changes: across a refresh, outlines
 * landing, a session or a day they studied, every phase still ahead keeps its end date. A learn
 * plan's last dated phase, before or after the step (its end is the goal's finish; phases a date
 * cuts short have none), and an after-exam phase are left out. So is a phase that lost its dates
 * with nothing left to do: it left the plan for time, and R5 judges whether the change names it.
 * A phase the learner finished is left out too: it shows the days it was finished on, not a date
 * still ahead of them (language seed 1083 finished one ahead). A learner's change, a missed day
 * and a test-out may move them.
 */
export function checkPhaseEndsKept(context: RuleContext): RuleViolation[] {
  const { after, before, event, today } = context;

  if (!before || !keepsPhaseEnds(event)) {
    return [];
  }

  const learnOnly = before.phases.every((phase) => phase.kind === "learn");
  const finishes = learnOnly ? [findLastDatedPhase(before), findLastDatedPhase(after)] : [];
  const todayIso = toDay(today.getTime()) ?? "";

  return before.phases.flatMap((phase, index) => {
    const end = after.phases[index]?.endDate ?? null;

    const left =
      end === null && !after.items.some((item) => item.phase === index && item.status === "todo");

    const ahead =
      phase.endDate !== null &&
      phase.endDate >= todayIso &&
      phase.kind !== "afterExam" &&
      !finishes.includes(index) &&
      !left &&
      !isPhaseFinished({ index, plan: after });

    return ahead && end !== phase.endDate
      ? [
          {
            details: { after: end, before: phase.endDate, phase: index },
            message: `Phase ${index + 1}'s end moved from ${phase.endDate} to ${end ?? "nowhere"} through a ${event.kind}.`,
            rule: "R6",
          },
        ]
      : [];
  });
}

/** Today's lessons still to do, in the plan's order. */
function listToday({ day, items }: { day: Date; items: readonly RuleItem[] }): RuleItem[] {
  return items.filter((item) => isTodoLesson(item) && isDueOn({ day, item }));
}

/** An item of today's session after the step, as one of the session's units before it, or new. */
function toSessionUnit({ item, units }: { item: RuleItem; units: ReadonlySet<string> }): string {
  const key = getRuleItemKey(item);
  const standIn = `skill:${item.skillId ?? ""}`;

  if (units.has(key)) {
    return key;
  }

  return units.has(standIn) ? standIn : `new:${key}`;
}

/**
 * R7. Today's session doesn't change under the learner: once they saw it, a refresh or lessons
 * landing never removes or reorders its lessons (a stand-in's landed lessons take its place) and
 * puts anything new after them.
 */
export function checkTodayKept(context: RuleContext): RuleViolation[] {
  const { after, before, event, today, todayShown } = context;

  if (!before || !todayShown || !SYSTEM_EVENTS.has(event.kind)) {
    return [];
  }

  const was = listToday({ day: today, items: before.items }).map((item) => getRuleItemKey(item));
  const units = new Set(was);

  const now = listToday({ day: today, items: after.items }).map((item) =>
    toSessionUnit({ item, units }),
  );

  const kept = [...new Set(now.filter((unit) => units.has(unit)))];
  const lastKept = now.findLastIndex((unit) => units.has(unit));
  const firstNew = now.findIndex((unit) => unit.startsWith("new:"));

  const problems = [
    kept.length < was.length && { lost: was.filter((unit) => !kept.includes(unit)) },
    kept.join(",") !== was.filter((unit) => kept.includes(unit)).join(",") && { reordered: kept },
    firstNew !== -1 && firstNew < lastKept && { insertedBefore: now[lastKept] },
  ].filter((problem) => problem !== false);

  return problems.map((details) => ({
    details,
    message: `Today's session changed under the learner through a ${event.kind}.`,
    rule: "R7",
  }));
}

/** Moved items a violation names at most. */
const MAX_NAMED = 5;

/**
 * R32. A run with nothing new changes nothing: a `refresh` (opening the app again the same day,
 * with no progress, no lessons landed and no change) leaves every item where it was, with the
 * status and the day it had. The first run to see what the learner finished since the plan was
 * planned (`progressed`: a partial session plans nothing) adapts to it, as plans do to progress.
 */
export function checkRefreshChangesNothing(context: RuleContext): RuleViolation[] {
  const { after, before, event } = context;

  if (!before || event.kind !== "refresh" || event.progressed) {
    return [];
  }

  const was = new Set(before.items.map((item) => describeItem(item)));
  const keys = new Set(before.items.map((item) => getRuleItemKey(item)));

  // An item both plans hold whose status or day changed; one only one of them holds is lost or added.
  const moved = after.items
    .filter((item) => keys.has(getRuleItemKey(item)) && !was.has(describeItem(item)))
    .map((item) => describeItem(item));

  const lost = listMissingItems({ from: before, to: after }).length;
  const added = listMissingItems({ from: after, to: before }).length;

  return moved.length + lost + added > 0
    ? [
        {
          details: { added, lost, moved: moved.slice(0, MAX_NAMED), movedCount: moved.length },
          message: "A refresh with nothing new moved the plan.",
          rule: "R32",
        },
      ]
    : [];
}

/**
 * Whether an undo may leave an item of the plan it gives back as it is now: a lesson the learner
 * finished since the change, or one due on a day that has passed, which comes back from today on.
 */
function isSettledSince({
  finished,
  item,
  today,
}: {
  finished: ReadonlySet<string>;
  item: RuleItem;
  today: Date;
}): boolean {
  return (
    finished.has(getRuleItemKey(item)) ||
    (item.status === "todo" && item.scheduledFor !== null && item.scheduledFor < today)
  );
}

/**
 * R38. Undo gives back the plan the learner had: after undoing a change (an edit, or a test-out's
 * skipped lessons), every item of the plan right before that change (`event.restores`) is there
 * with the status and the day it had, nothing else is, and each phase ends where it did. What the
 * learner finished since stays done, and what was due on a day now past comes back from today on.
 */
export function checkUndoRestores(context: RuleContext): RuleViolation[] {
  const { after, before, event, today } = context;

  if (event.kind !== "undo") {
    return [];
  }

  const { restores } = event;

  const finished = new Set(
    (before?.items ?? [])
      .filter((item) => item.status === "done")
      .map((item) => getRuleItemKey(item)),
  );

  const kept = restores.items.filter((item) => !isSettledSince({ finished, item, today }));
  const was = new Set(kept.map((item) => describeItem(item)));
  const keys = new Set(kept.map((item) => getRuleItemKey(item)));

  const moved = after.items
    .filter((item) => keys.has(getRuleItemKey(item)) && !was.has(describeItem(item)))
    .map((item) => describeItem(item));

  const lost = listMissingItems({ from: { ...restores, items: kept }, to: after }).length;
  const added = listMissingItems({ from: after, to: restores }).length;
  const todayIso = toDay(today.getTime()) ?? "";

  const phaseEnds = restores.phases.flatMap((phase, index) => {
    const end = after.phases[index]?.endDate ?? null;
    const ahead = phase.endDate === null || phase.endDate >= todayIso;

    return ahead && end !== phase.endDate
      ? [{ after: end, before: phase.endDate, phase: index }]
      : [];
  });

  return moved.length + lost + added + phaseEnds.length > 0
    ? [
        {
          details: {
            added,
            change: event.change,
            lost,
            moved: moved.slice(0, MAX_NAMED),
            movedCount: moved.length,
            phaseEnds,
          },
          message: "An undo didn't give back the plan the learner had.",
          rule: "R38",
        },
      ]
    : [];
}
