import { normalizeString } from "@zoonk/utils/string";
import { toIsoDate } from "../../planner/plan-calendar";
import { type RuleContext, type RuleItem, type RulePlan, type RuleViolation } from "./rule-context";
import {
  describeItem,
  getRuleItemKey,
  isTodoLesson,
  listMissingItems,
  sumTodoLessons,
} from "./rule-items";

/** Moved items a violation names at most. */
const MAX_NAMED = 5;

/** The kinds of item known by their date (see `getRuleItemKey`). */
const DATED_KINDS = new Set<RuleItem["kind"]>(["checkpoint", "mock", "review"]);

function toIsoDay(item: RuleItem): string | null {
  return item.scheduledFor ? toIsoDate(item.scheduledFor) : null;
}

/** The first day among items, as an ISO date; null when none is dated. */
function findFirstDay(items: readonly RuleItem[]): string | null {
  return items.reduce<string | null>((first, item) => {
    const day = toIsoDay(item);
    return day && (!first || day < first) ? day : first;
  }, null);
}

/**
 * The skills whose lessons landed in a step: a stand-in for them in the plan before, and a written
 * lesson of theirs after that the plan before didn't hold.
 */
function listLandedSkillIds({ after, before }: { after: RulePlan; before: RulePlan }) {
  const standIns = new Set(
    before.items.flatMap((item) =>
      item.kind === "lesson" && !item.lessonId && item.skillId ? [item.skillId] : [],
    ),
  );

  const held = new Set(before.items.flatMap((item) => (item.lessonId ? [item.lessonId] : [])));

  return new Set(
    after.items.flatMap((item) =>
      item.lessonId && item.skillId && standIns.has(item.skillId) && !held.has(item.lessonId)
        ? [item.skillId]
        : [],
    ),
  );
}

/**
 * The landed skills whose lessons don't take their stand-in's place: another skill's lesson that
 * came after the stand-in's first day now comes before them. A lesson that no longer fits that day
 * may start the next, as long as nothing gets ahead of it (IELTS seed 1's day-one landing).
 */
function listLandedLate({
  after,
  before,
  landed,
}: {
  after: RulePlan;
  before: RulePlan;
  landed: ReadonlySet<string>;
}): string[] {
  const now = new Map(after.items.map((item) => [getRuleItemKey(item), toIsoDay(item)]));

  const laterWork = before.items.filter(
    (item) =>
      (item.kind === "lesson" || item.kind === "chapter") &&
      item.status === "todo" &&
      (!item.skillId || !landed.has(item.skillId)),
  );

  return [...landed].filter((skillId) => {
    const standIn = findFirstDay(
      before.items.filter((item) => item.skillId === skillId && !item.lessonId),
    );

    const first = findFirstDay(after.items.filter((item) => item.skillId === skillId));

    return (
      standIn !== null &&
      first !== null &&
      laterWork.some((item) => {
        const was = toIsoDay(item);
        const day = now.get(getRuleItemKey(item));
        return was !== null && was > standIn && day !== null && day !== undefined && day < first;
      })
    );
  });
}

/**
 * R41. A landing moves only what it touches: when the Library's lessons land (`outlinesLanded`),
 * they take their stand-in's place: nothing of another skill that came after it gets ahead of
 * them. Every item of a skill whose lessons didn't land, and every item of no skill, stays in the
 * plan with its status, none comes in, and what's due before the first day a landed skill holds
 * keeps its day. What comes after may move to fit lessons that take more or less time than their
 * stand-in held, into another phase's time too where a kept end holds (career seed 3: day one's
 * landing moved 146 later items 1 to 5 days later), and a practice day there, known by its date,
 * may give way (IELTS seed 2), a lesson whose title a landed lesson teaches leaves, as a plan
 * teaches a title once (career seed 1163), and when the landed skills hold more lessons than their
 * stand-ins did, as many other lessons still to do may leave for the time (career seed 1180). A reshuffle swaps topics or moves the landed lessons
 * away (OAB seed 2003, Câmara seed 2001).
 */
export function checkLandingMovesOnlyLanded(context: RuleContext): RuleViolation[] {
  const { after, before, event } = context;

  if (!before || event.kind !== "outlinesLanded") {
    return [];
  }

  const landed = listLandedSkillIds({ after, before });
  const isLanded = (item: RuleItem) => item.skillId !== null && landed.has(item.skillId);
  const others = (items: readonly RuleItem[]) => items.filter((item) => !isLanded(item));
  const was = new Map(others(before.items).map((item) => [getRuleItemKey(item), item]));

  const firstLanded = findFirstDay(
    [...before.items, ...after.items].filter((item) => isLanded(item)),
  );

  const mayMove = ({ from, to }: { from: RuleItem; to: RuleItem }) => {
    const day = toIsoDay(from);

    return from.status === to.status && firstLanded !== null && day !== null && day >= firstLanded;
  };

  const moved = after.items.filter((item) => {
    const from = was.get(getRuleItemKey(item));
    return from && describeItem(from) !== describeItem(item) && !mayMove({ from, to: item });
  });

  // A practice day, a mock or a weekly challenge is known by its date: moving it is giving way.
  const isDatedAfter = (item: RuleItem) => {
    const day = toIsoDay(item);
    return DATED_KINDS.has(item.kind) && firstLanded !== null && day !== null && day >= firstLanded;
  };

  const changed = (items: readonly RuleItem[]) =>
    others(items).filter((item) => !isDatedAfter(item)).length;

  // A plan teaches a title once (`withoutRepeatedTitles`): a lesson whose title a landed lesson
  // now holds leaves with it.
  const landedTitles = new Set(
    after.items.flatMap((item) =>
      isLanded(item) && item.lessonId ? [normalizeString(item.titleSnapshot)] : [],
    ),
  );

  const isTaughtByLanded = (item: RuleItem) =>
    item.lessonId !== null && landedTitles.has(normalizeString(item.titleSnapshot));

  // Lessons that take more than their stand-in held need time: as many other lessons still to do
  // may leave for it (R11 judges which, R5 that the change names them), but no more.
  const grown =
    sumTodoLessons(after.items.filter((item) => isLanded(item))) -
    sumTodoLessons(before.items.filter((item) => isLanded(item)));

  const gone = others(listMissingItems({ from: before, to: after })).filter(
    (item) => !isTaughtByLanded(item),
  );

  const forTime = gone.filter((item) => isTodoLesson(item));
  const late = listLandedLate({ after, before, landed });

  const lost = changed(
    sumTodoLessons(forTime) <= grown ? gone.filter((item) => !forTime.includes(item)) : gone,
  );

  const added = changed(listMissingItems({ from: after, to: before }));

  return moved.length + late.length + lost + added > 0
    ? [
        {
          details: {
            added,
            landed: [...landed],
            late,
            lost,
            moved: moved.slice(0, MAX_NAMED).map((item) => describeItem(item)),
            movedCount: moved.length,
          },
          message: "A landing moved what it didn't touch.",
          rule: "R41",
        },
      ]
    : [];
}
