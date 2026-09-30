import { type PlanItemStatus } from "@zoonk/db";
import { type PlanChapterView, type PlanPhaseView } from "../plan-view-contract";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanPhase } from "../planner/plan-state";
import { type ShortPlanShape, toShortPhaseView } from "./short-plan-view";

const MINUTES_PER_HOUR = 60;

const isFinished = (status: PlanItemStatus) => status !== "todo";

type PhaseItem = Pick<ExistingPlanItem, "chapterId" | "kind" | "lessonId" | "phase" | "status">;

/**
 * The next thing to do in plan order. A stand-in waiting for lessons the Library hasn't outlined
 * yet doesn't hold the plan back while written work comes after it: the learner is already doing
 * that.
 */
export function findNextItem<Item extends PhaseItem>(items: readonly Item[]): Item | undefined {
  const todo = items.filter((item) => item.status === "todo");
  return todo.find((item) => !isWritingItem(item)) ?? todo[0];
}

/**
 * The phase the learner is in, the same on Plan and on the map: the phase of the next thing to
 * do, or the last phase once everything is done.
 */
export function findCurrentPhase({
  items,
  phaseCount,
}: {
  items: readonly PhaseItem[];
  phaseCount: number;
}): number | null {
  const next = findNextItem(items);

  if (next) {
    return next.phase;
  }

  return phaseCount > 0 && items.length > 0 ? phaseCount - 1 : null;
}

/** Each skill's area: the course a stand-in for its lessons is shown under. */
export type SkillAreas = ReadonlyMap<string, string | null>;

/** A stand-in for a skill whose lessons the Library hasn't outlined yet. */
export function isWritingItem(
  item: Pick<ExistingPlanItem, "chapterId" | "kind" | "lessonId">,
): boolean {
  return item.kind === "lesson" && item.lessonId === null && item.chapterId === null;
}

/** The learner-facing title of a stand-in: its skill's course, never the skill's raw name. */
export function getWritingTitle({
  item,
  skillAreas,
}: {
  item: Pick<ExistingPlanItem, "skillId">;
  skillAreas: SkillAreas;
}): string {
  return (item.skillId && skillAreas.get(item.skillId)) || "";
}

/**
 * A stand-in placement settled (the skill was tested out before its lessons were written) isn't
 * being written: it groups apart from the stand-ins still waiting for their lessons.
 */
function getGroupKey({ item, skillAreas }: { item: ExistingPlanItem; skillAreas: SkillAreas }) {
  if (item.chapterId) {
    return item.chapterId;
  }

  if (!isWritingItem(item)) {
    return `item:${item.skillId ?? item.id}`;
  }

  const title = getWritingTitle({ item, skillAreas });
  return isFinished(item.status) ? `settled:${title}` : `writing:${title}`;
}

/**
 * The skills a row of settled stand-ins stands for, by name in plan order: placement tested them
 * out before their lessons were written, so the row names them rather than their course.
 */
function getSettledSkills(inGroup: readonly ExistingPlanItem[]): string[] {
  const [first] = inGroup;

  if (!first || !isWritingItem(first) || !isFinished(first.status)) {
    return [];
  }

  return [...new Set(inGroup.map((item) => item.titleSnapshot))];
}

function getChapterTitle({
  chapterTitles,
  item,
  skillAreas,
}: {
  chapterTitles: ReadonlyMap<string, string>;
  item: ExistingPlanItem;
  skillAreas: SkillAreas;
}): string {
  if (item.chapterId) {
    return chapterTitles.get(item.chapterId) || item.titleSnapshot;
  }

  return isWritingItem(item) ? getWritingTitle({ item, skillAreas }) : item.titleSnapshot;
}

/**
 * The current phase chapter by chapter, in plan order: lessons done of the total, and which one
 * the learner is in: the one holding the next thing to do, as on the map. Skills whose lessons
 * aren't outlined yet group under their course as one `writing` row until their chapters exist;
 * the ones placement tested out before then are one finished row of their own.
 */
function buildChapters({
  chapterTitles,
  lessons,
  skillAreas,
}: {
  chapterTitles: ReadonlyMap<string, string>;
  lessons: readonly ExistingPlanItem[];
  skillAreas: SkillAreas;
}): PlanChapterView[] {
  const keys = [...new Set(lessons.map((item) => getGroupKey({ item, skillAreas })))];

  const groups = keys.flatMap((key) => {
    const inGroup = lessons.filter((item) => getGroupKey({ item, skillAreas }) === key);
    const [first] = inGroup;

    if (!first) {
      return [];
    }

    return {
      chapterId: first.chapterId,
      key,
      lessonsDone: inGroup.filter((item) => isFinished(item.status)).length,
      lessonsTotal: inGroup.length,
      skills: getSettledSkills(inGroup),
      testedOut: inGroup.every((item) => item.status === "testedOut"),
      title: getChapterTitle({ chapterTitles, item: first, skillAreas }),
      writing: isWritingItem(first) && !isFinished(first.status),
    };
  });

  const next = findNextItem(lessons);
  const currentKey = next ? getGroupKey({ item: next, skillAreas }) : null;

  /** A chapter finished ahead of the current one (lessons often interleave) still reads as done. */
  return groups.map(({ key, ...group }) => {
    if (group.lessonsDone === group.lessonsTotal) {
      return { ...group, state: "done" as const };
    }

    return { ...group, state: key === currentKey ? ("current" as const) : ("upcoming" as const) };
  });
}

/** Where a phase or chapter stands against the current one; every one is done without one. */
export function getProgressState({ current, index }: { current: number | null; index: number }) {
  if (current === null || index < current) {
    return "done" as const;
  }

  return index === current ? ("current" as const) : ("upcoming" as const);
}

/**
 * A phase's size in minutes: the planner's, or, for a phase saved without it, its share of the
 * plan's estimate by lessons, so no phase reads as zero hours.
 */
function getPhaseMinutes({
  estimateMinutes,
  index,
  items,
  phase,
}: {
  estimateMinutes: number | null;
  index: number;
  items: readonly ExistingPlanItem[];
  phase: PlanPhase;
}): number {
  const lessons = items.filter((item) => item.kind === "lesson");

  if (phase.minutes > 0 || !estimateMinutes || lessons.length === 0) {
    return phase.minutes;
  }

  const inPhase = lessons.filter((item) => item.phase === index).length;
  return (estimateMinutes * inPhase) / lessons.length;
}

/**
 * Every phase with its dates, size and progress. Only the current phase opens chapter by chapter,
 * so the screen stays calm however big the goal is.
 */
export function buildPhaseViews({
  chapterTitles,
  currentPhase,
  estimateMinutes = null,
  items,
  phases,
  shortPlan = null,
  skillAreas,
}: {
  chapterTitles: ReadonlyMap<string, string>;
  currentPhase: number | null;
  /** The whole plan's estimate, for phases saved without their own minutes. */
  estimateMinutes?: number | null;
  items: readonly ExistingPlanItem[];
  phases: readonly PlanPhase[];
  /** A test days away: its phases say which of its days they cover. */
  shortPlan?: ShortPlanShape | null;
  skillAreas: SkillAreas;
}): PlanPhaseView[] {
  return phases.map((phase, index) => {
    const lessons = items.filter((item) => item.phase === index && item.kind === "lesson");
    const minutes = getPhaseMinutes({ estimateMinutes, index, items, phase });

    return {
      chapterCount: new Set(lessons.map((item) => getGroupKey({ item, skillAreas }))).size,
      chapters:
        index === currentPhase ? buildChapters({ chapterTitles, lessons, skillAreas }) : null,
      endDate: phase.endDate,
      hours: Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10,
      index,
      kind: phase.kind,
      lessonsDone: lessons.filter((item) => isFinished(item.status)).length,
      lessonsTotal: lessons.length,
      milestone: phase.milestone,
      name: phase.name,
      short: toShortPhaseView({ phase, shape: shortPlan }),
      startDate: phase.startDate,
      state: getProgressState({ current: currentPhase, index }),
    };
  });
}
