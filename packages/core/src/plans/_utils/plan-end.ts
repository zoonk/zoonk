import { type Goal, type PlanItem } from "@zoonk/db";
import { LEARN_KINDS } from "../planner/plan-item-rules";
import { type ExistingPlanItem } from "../planner/plan-items";
import { countLessons } from "./stand-in-lessons";
import { getWorkProgress, isWorkFinished } from "./work-progress";

const EXAM_DAY_KINDS = new Set<PlanItem["kind"]>(["mock", "review"]);

type EndItem = Pick<PlanItem, "kind" | "status">;

type DatedEndItem = EndItem & Pick<PlanItem, "scheduledFor">;

type LeftItem = Pick<
  ExistingPlanItem,
  "chapterId" | "kind" | "lessonId" | "lessons" | "skillId" | "status"
>;

type PlanEndInput = {
  phaseChallengesRequired?: boolean;
  goalKind: Goal["kind"];
  items: readonly DatedEndItem[];
  studiesPastTarget?: boolean;
  targetDate: Date | null;
  today: Date;
};

const isTodo = (item: Pick<PlanItem, "status">) => getWorkProgress(item.status) === "todo";

const isSetAsideLesson = (item: EndItem) =>
  LEARN_KINDS.has(item.kind) && getWorkProgress(item.status) === "setAside";

export function hasPlanDeadline({
  studiesPastTarget = false,
  targetDate,
}: Pick<PlanEndInput, "studiesPastTarget" | "targetDate">): boolean {
  return targetDate !== null && !studiesPastTarget;
}

function isInLessonScope({ deadline, item }: { deadline: boolean; item: EndItem }): boolean {
  return LEARN_KINDS.has(item.kind) && (deadline || !isSetAsideLesson(item));
}

export function withinLessonScope<Item extends EndItem>({
  deadline,
  items,
}: {
  deadline: boolean;
  items: readonly Item[];
}): Item[] {
  return items.filter((item) => !LEARN_KINDS.has(item.kind) || isInLessonScope({ deadline, item }));
}

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

export function areLessonsFinished({
  items,
  studiesPastTarget = false,
  targetDate,
}: Pick<PlanEndInput, "items" | "studiesPastTarget" | "targetDate">): boolean {
  const deadline = hasPlanDeadline({ studiesPastTarget, targetDate });
  const lessons = items.filter((item) => isInLessonScope({ deadline, item }));

  return lessons.length > 0 && lessons.every((item) => isWorkFinished(item.status));
}

export function countChallengesLeft(input: PlanEndInput): number {
  if (input.phaseChallengesRequired === false) {
    return 0;
  }

  const challenges = input.items.filter((item) => item.kind === "boss" && isTodo(item));
  const rest = input.items.filter((item) => item.kind !== "boss");

  return challenges.length > 0 && isPlanFinished({ ...input, items: rest }) ? challenges.length : 0;
}

export function countLessonsLeft(items: readonly LeftItem[]): number {
  return countLessons(
    items.filter((item) => LEARN_KINDS.has(item.kind) && (isTodo(item) || isSetAsideLesson(item))),
  );
}

/** `today` and `targetDate` are UTC-midnight labels of the learner's days. */
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
