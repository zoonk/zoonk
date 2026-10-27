import { type RuleContext, type RuleItem, type RuleViolation } from "./rule-context";
import {
  findFirstDue,
  getAreaOf,
  getRuleItemKey,
  isTodoLesson,
  listOutByChoice,
} from "./rule-items";

/** Whether a lesson of the plan the learner saw is still somewhere in the new plan, set aside too. */
function isStillPlanned({ item, items }: { item: RuleItem; items: readonly RuleItem[] }) {
  return item.lessonId
    ? items.some((other) => other.lessonId === item.lessonId)
    : items.some((other) => other.kind === "lesson" && other.skillId === item.skillId);
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
