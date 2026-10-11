import {
  type RuleContext,
  type RuleEvent,
  type RuleItem,
  type RuleViolation,
} from "./rule-context";
import {
  findFirstDue,
  getAreaOf,
  getRuleItemKey,
  isTodoLesson,
  listOutByChoice,
  toDay,
} from "./rule-items";

/** Steps the learner didn't ask for: the plan may only follow what it learned on its own. */
const SYSTEM_EVENTS = new Set<RuleEvent["kind"]>(["outlinesLanded", "refresh"]);

/** Steps that may not drop work a past day left: every one but the learner's own change. */
function keepsUnfinished(event: RuleEvent): boolean {
  return (
    SYSTEM_EVENTS.has(event.kind) ||
    ["newDay", "placement", "session", "testOut"].includes(event.kind)
  );
}

/** Whether a lesson of the plan the learner saw is still somewhere in the new plan, set aside too. */
function isStillPlanned({ item, items }: { item: RuleItem; items: readonly RuleItem[] }) {
  return item.lessonId
    ? items.some((other) => other.lessonId === item.lessonId)
    : items.some((other) => other.kind === "lesson" && other.skillId === item.skillId);
}

/**
 * R8. Unfinished work carries over: a lesson an earlier day left to do is still in the plan after
 * any step but the learner's own change (done, tested out, set aside or still to do). From an
 * exam's day on, nothing is left to carry it to, unless the plan studies everything past the date.
 */
export function checkUnfinishedKept(context: RuleContext): RuleViolation[] {
  const { after, before, event, today } = context;
  const { targetDate } = after.goal;
  const examCame = targetDate !== null && today >= targetDate && !after.settings.fullCourse;

  if (!before || !keepsUnfinished(event) || examCame) {
    return [];
  }

  return before.items
    .filter((item) => isTodoLesson(item) && item.scheduledFor !== null && item.scheduledFor < today)
    .filter((item) => !isStillPlanned({ item, items: after.items }))
    .map((item) => ({
      details: { due: toDay(item.scheduledFor?.getTime() ?? null), lesson: item.titleSnapshot },
      message: `An unfinished lesson left the plan through a ${event.kind}.`,
      rule: "R8",
    }));
}

/**
 * R8. Finished work stays finished: a lesson or event the learner finished is still finished in the
 * plan after any step, a learner's change included (past work never moves).
 */
export function checkFinishedKept(context: RuleContext): RuleViolation[] {
  const { after, before, event } = context;

  if (!before) {
    return [];
  }

  const done = new Set(
    after.items.filter((item) => item.status === "done").map((item) => getRuleItemKey(item)),
  );

  return before.items
    .filter((item) => item.status === "done" && !done.has(getRuleItemKey(item)))
    .map((item) => ({
      details: { kind: item.kind, title: item.titleSnapshot },
      message: `Finished work left the plan or was undone through a ${event.kind}.`,
      rule: "R8",
    }));
}

/** The chapter of the last lesson the learner finished, while it has lessons left to do. */
function findChapterInProgress(items: readonly RuleItem[]): string | null {
  const last = items
    .filter((item) => item.kind === "lesson" && item.status === "done" && item.completedAt)
    .toSorted((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
    .at(0);

  const chapterId = last?.chapterId ?? null;
  const hasLeft = items.some((item) => isTodoLesson(item) && item.chapterId === chapterId);

  return chapterId && hasLeft ? chapterId : null;
}

/**
 * R10. A learner's change never pushes out the chapter they're in the middle of: its lessons left
 * stay in the plan, and no lesson of its phase that came after them comes before them now (Carla's
 * added topic sent hers to March). Another area's lesson counts only when the chapter's next lesson
 * comes later than it did: an exam's study cycle gives each subject its turn every day, so another
 * subject's turn before the chapter's next lesson doesn't push it. A change that takes its area out,
 * or passes over the chapter's skill by choice, is left out.
 */
export function checkChapterInProgressKept(context: RuleContext): RuleViolation[] {
  const { after, before, event } = context;
  const chapterId = before ? findChapterInProgress(before.items) : null;

  if (!before || !chapterId || event.kind !== "learnerChange") {
    return [];
  }

  // A skill the change passes over by choice (a skipped base, the basics of an area "too basic")
  // leaves with its chapter: the learner chose it, and the card names its lessons.
  const out = listOutByChoice(after);

  const remaining = before.items.filter(
    (item) => isTodoLesson(item) && item.chapterId === chapterId && !out.has(item.skillId ?? ""),
  );

  if (remaining.length === 0) {
    return [];
  }

  const areaOf = getAreaOf(before.graph);
  const area = areaOf(remaining[0]?.skillId ?? null);

  const skipsArea = event.operations.some(
    (operation) => operation.kind === "skipAreas" && operation.areas.includes(area ?? ""),
  );

  if (skipsArea) {
    return [];
  }

  const lost = remaining.filter((item) => !isStillPlanned({ item, items: after.items }));
  const phase = Math.min(...remaining.map((item) => item.phase));

  const [firstBefore, firstAfter] = [
    findFirstDue(remaining),
    findFirstDue(after.items.filter((item) => isTodoLesson(item) && item.chapterId === chapterId)),
  ];

  const delayed = firstBefore !== null && (firstAfter === null || firstAfter > firstBefore);

  const dueBefore = new Map(
    before.items.map((item) => [getRuleItemKey(item), item.scheduledFor?.getTime() ?? null]),
  );

  const jumped = after.items.filter((item) => {
    const was = dueBefore.get(getRuleItemKey(item)) ?? null;
    const now = item.scheduledFor?.getTime() ?? null;
    const cameAfter = was === null || firstBefore === null || was > firstBefore;
    const isAhead = now !== null && firstAfter !== null && now < firstAfter;

    return (
      isTodoLesson(item) &&
      item.chapterId !== chapterId &&
      item.phase === phase &&
      (delayed || areaOf(item.skillId) === area) &&
      cameAfter &&
      isAhead
    );
  });

  return [
    ...lost.map((item) => ({
      details: { lesson: item.titleSnapshot },
      message: "A lesson of the chapter in progress left the plan.",
      rule: "R10",
    })),
    ...jumped.map((item) => ({
      details: { lesson: item.titleSnapshot },
      message: "A lesson now comes before the rest of the chapter in progress.",
      rule: "R10",
    })),
  ];
}
