import { type Goal, type PlanItem } from "@zoonk/db";
import { type ExistingPlanItem } from "../planner/plan-items";
import { countLessons } from "./stand-in-lessons";
import { getWorkProgress, isWorkFinished } from "./work-progress";

/** Lessons and chapters are what a plan teaches; checkpoints and reviews come around them. */
const LEARN_KINDS = new Set<PlanItem["kind"]>(["chapter", "lesson"]);

/** An exam's rehearsals and the reviews before its day: a plan isn't over while one is ahead. */
const EXAM_DAY_KINDS = new Set<PlanItem["kind"]>(["mock", "review"]);

type EndItem = Pick<PlanItem, "kind" | "status">;

type DatedEndItem = EndItem & Pick<PlanItem, "scheduledFor">;

type LeftItem = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

/** A plan's items and the day they're read on, as `isPlanFinished` reads them. */
type PlanEndInput = {
  /** A Free language plan advances without its Plus-only call challenges. */
  phaseChallengesRequired?: boolean;
  goalKind: Goal["kind"];
  items: readonly DatedEndItem[];
  /** An exam the learner goes on studying after: past its date, it has no deadline either. */
  studiesPastTarget?: boolean;
  targetDate: Date | null;
  /** The learner's day, as a UTC-midnight label like `scheduledFor`. */
  today: Date;
};

const isTodo = (item: Pick<PlanItem, "status">) => getWorkProgress(item.status) === "todo";

const isSetAsideLesson = (item: EndItem) =>
  LEARN_KINDS.has(item.kind) && getWorkProgress(item.status) === "setAside";

/** The plan's lessons must fit by a date: the goal's own, or an exam's the learner stops at. */
export function hasPlanDeadline({
  studiesPastTarget = false,
  targetDate,
}: Pick<PlanEndInput, "studiesPastTarget" | "targetDate">): boolean {
  return targetDate !== null && !studiesPastTarget;
}

/**
 * A lesson or chapter in the plan's scope: what its number counts (`SyllabusView.lessons`) and
 * finishing it waits for. That's every lesson the plan holds, studied, known, to do or set aside,
 * but one a plan without a deadline set aside: such a plan never runs out of time, so it only sets
 * aside lessons the Library couldn't write (see `moveOnWithoutLesson`), and nothing is left for the
 * learner there. Lessons the plan cut to fit its date aren't in it, so finishing the plan the
 * learner chose reads 100%: one that fitted 19 of its graph's 28 lessons read "Finished" at 68%.
 */
function isInLessonScope({ deadline, item }: { deadline: boolean; item: EndItem }): boolean {
  return LEARN_KINDS.has(item.kind) && (deadline || !isSetAsideLesson(item));
}

/**
 * The plan's items without the lessons out of its scope (see `isInLessonScope`), so its phases,
 * chapters and subjects count what its number and "finished" count.
 */
export function withinLessonScope<Item extends EndItem>({
  deadline,
  items,
}: {
  deadline: boolean;
  items: readonly Item[];
}): Item[] {
  return items.filter((item) => !LEARN_KINDS.has(item.kind) || isInLessonScope({ deadline, item }));
}

/**
 * Work around the lessons the learner can still do: a phase's challenge until it's won (a new
 * day's settling carries a missed one), or an exam's rehearsal or review. Once the plan's date
 * came, the rehearsals and reviews due before today are behind the learner, as the date is (a plan
 * that goes on after an exam keeps the ones ahead).
 */
function isClosingWorkLeft({
  phaseChallengesRequired = true,
  goalKind,
  item,
  targetDate,
  today,
}: {
  phaseChallengesRequired?: boolean;
  goalKind: Goal["kind"];
  item: DatedEndItem;
  targetDate: Date | null;
  today: Date | null;
}): boolean {
  if (item.kind === "boss") {
    return phaseChallengesRequired && isTodo(item);
  }

  if (goalKind !== "exam") {
    return false;
  }

  const past =
    targetDate !== null &&
    today !== null &&
    today.getTime() >= targetDate.getTime() &&
    item.scheduledFor !== null &&
    item.scheduledFor.getTime() < today.getTime();

  return EXAM_DAY_KINDS.has(item.kind) && isTodo(item) && !past;
}

/**
 * Nothing of the plan is left to do: every lesson and chapter is behind the learner, every phase's
 * challenge won, and an exam's mocks and the reviews before it done too (tested out days before a
 * class test, its lessons leave the short mock to do), by the same rule as `isPlanFinished`. It's
 * finished only when none was set aside; over, its phases read done or unfinished, none current.
 */
export function isPlanOver({
  phaseChallengesRequired = true,
  goalKind,
  items,
  targetDate = null,
  today = null,
}: {
  phaseChallengesRequired?: boolean;
  goalKind: Goal["kind"];
  items: readonly DatedEndItem[];
  targetDate?: Date | null;
  /** The learner's day; without it, every mock and review still to do is ahead. */
  today?: Date | null;
}): boolean {
  const learn = items.filter((item) => LEARN_KINDS.has(item.kind));

  return (
    learn.length > 0 &&
    !learn.some((item) => isTodo(item)) &&
    !items.some((item) =>
      isClosingWorkLeft({ goalKind, item, phaseChallengesRequired, targetDate, today }),
    )
  );
}

/**
 * The learner finished their plan: every lesson in its scope (see `isInLessonScope`) studied or
 * tested out, so its number reads 100%; every phase's challenge won, so its path reads every phase
 * done; and, for an exam, no mock or review still ahead (see `isClosingWorkLeft`). Other goals'
 * reviews remain practice after finishing. Only then do the apps say
 * "Finished" and offer what's next. Lessons set aside are still the learner's to study: missed
 * days the plan couldn't fit back by its date, or the date came first (`pastDate`, see
 * `getPlanStatus`), and the plan keeps them until the learner adjusts it. Rafaela's plan would have
 * said "You finished your plan" over lessons she never studied; Lucas's, a day past his date, said
 * "Your plan ended" and offered the course's next level over 13 of them; Pedro's said "Finished"
 * and "Continue at Beginner" beside "0 of 4 phases done", its challenges still to win.
 */
export function isPlanFinished({
  phaseChallengesRequired = true,
  goalKind,
  items,
  studiesPastTarget = false,
  targetDate,
  today,
}: PlanEndInput): boolean {
  return (
    areLessonsFinished({ items, studiesPastTarget, targetDate }) &&
    !items.some((item) =>
      isClosingWorkLeft({ goalKind, item, phaseChallengesRequired, targetDate, today }),
    )
  );
}

/**
 * Every lesson in the plan's scope (see `isInLessonScope`) is studied or tested out: what's left,
 * if anything, is closing work around them (see `isPlanFinished`), and no run adds lessons on its
 * own (see `refreshGoalPlan`).
 */
export function areLessonsFinished({
  items,
  studiesPastTarget = false,
  targetDate,
}: Pick<PlanEndInput, "items" | "studiesPastTarget" | "targetDate">): boolean {
  const deadline = hasPlanDeadline({ studiesPastTarget, targetDate });
  const lessons = items.filter((item) => isInLessonScope({ deadline, item }));

  return lessons.length > 0 && lessons.every((item) => isWorkFinished(item.status));
}

/**
 * The phases' challenges still between the learner and a finished plan once nothing else is left:
 * every lesson done and only they to win (see `isPlanFinished`). 0 otherwise.
 */
export function countChallengesLeft(input: PlanEndInput): number {
  if (input.phaseChallengesRequired === false) {
    return 0;
  }

  const challenges = input.items.filter((item) => item.kind === "boss" && isTodo(item));
  const rest = input.items.filter((item) => item.kind !== "boss");

  return challenges.length > 0 && isPlanFinished({ ...input, items: rest }) ? challenges.length : 0;
}

/** The lessons the learner hasn't finished, to do or set aside, as every screen counts lessons. */
export function countLessonsLeft(items: readonly LeftItem[]): number {
  return countLessons(
    items.filter((item) => LEARN_KINDS.has(item.kind) && (isTodo(item) || isSetAsideLesson(item))),
  );
}

/**
 * The plan's date came: its lessons end before it, so from that day on it has no time for any. An
 * exam the learner goes on studying after (`studiesPastTarget`) keeps planning past it. `today` and
 * `targetDate` are UTC-midnight labels of the learner's days.
 */
export function isDateReached({
  studiesPastTarget,
  targetDate,
  today,
}: {
  studiesPastTarget: boolean;
  targetDate: Date | null;
  today: Date;
}): boolean {
  return !studiesPastTarget && targetDate !== null && today.getTime() >= targetDate.getTime();
}
