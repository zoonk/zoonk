import { type PlanItemStatus } from "@zoonk/db";
import {
  type PlanChapterView,
  type PlanPhaseCheckpointView,
  type PlanPhaseView,
} from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanPhase } from "../planner/plan-state";
import { type ShortPlanShape, toShortPhaseView } from "./short-plan-view";

const MINUTES_PER_HOUR = 60;

const isFinished = (status: PlanItemStatus) => status !== "todo";

type PhaseItem = Pick<ExistingPlanItem, "chapterId" | "kind" | "lessonId" | "phase" | "status">;

/**
 * The next thing to do, from the first item to do and the first one that isn't a stand-in. A
 * stand-in waiting for lessons the Library hasn't outlined yet doesn't hold the plan back while
 * written lessons come after it: the learner is already doing those. An event after stand-ins (a
 * mock, a checkpoint) does wait for them: it comes after their lessons, so the plan is still at
 * the stand-ins, such as day 1 of a test days away whose lessons are being written.
 */
export function chooseNextItem<Item extends Pick<PhaseItem, "kind">>({
  first,
  written,
  writtenIsLater,
}: {
  first: Item | undefined;
  written: Item | undefined;
  /** Stand-ins come before the written item. */
  writtenIsLater: boolean;
}): Item | undefined {
  return written && (!writtenIsLater || written.kind === "lesson") ? written : first;
}

/** The next thing to do in plan order (see `chooseNextItem`). */
export function findNextItem<Item extends PhaseItem>(items: readonly Item[]): Item | undefined {
  const todo = items.filter((item) => item.status === "todo");
  const [first] = todo;
  const written = todo.find((item) => !isWritingItem(item));

  return chooseNextItem({ first, written, writtenIsLater: written !== first });
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
 * A phase chapter by chapter, in plan order: lessons done of the total, and, in the current phase,
 * which one the learner is in: the one holding the next thing to do, as on the map. Skills whose
 * lessons aren't outlined yet group under their course as one `writing` row until their chapters
 * exist; the ones placement tested out before then are one finished row of their own.
 */
function buildChapters({
  chapterTitles,
  isCurrent,
  lessons,
  skillAreas,
}: {
  chapterTitles: ReadonlyMap<string, string>;
  /** Only the current phase has a chapter the learner is in. */
  isCurrent: boolean;
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

  const next = isCurrent ? findNextItem(lessons) : undefined;
  const currentKey = next ? getGroupKey({ item: next, skillAreas }) : null;

  /** A chapter finished ahead of the current one (lessons often interleave) still reads as done. */
  return groups.map(({ key, ...group }) => {
    if (group.lessonsDone === group.lessonsTotal) {
      return { ...group, state: "done" as const };
    }

    return { ...group, state: key === currentKey ? ("current" as const) : ("upcoming" as const) };
  });
}

/** The checkpoint that closes the phase, the Trickster's, when it has one. */
function buildCheckpoint(items: readonly ExistingPlanItem[]): PlanPhaseCheckpointView | null {
  const boss = items.find((item) => item.kind === "boss");

  if (!boss) {
    return null;
  }

  return {
    date: boss.scheduledFor ? toIsoDate(boss.scheduledFor) : null,
    planItemId: boss.id,
    state: isFinished(boss.status) ? "done" : "upcoming",
  };
}

/** The phase's mock exams: how many, and the day of the next one still to take. */
function buildMocks(items: readonly ExistingPlanItem[]): PlanPhaseView["mocks"] {
  const mocks = items.filter((item) => item.kind === "mock");

  const next = mocks
    .flatMap((item) =>
      item.status === "todo" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
    )
    .toSorted()[0];

  return { count: mocks.length, nextDate: next ?? null };
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
 * Every phase with its dates, size, progress, chapters and the checkpoint that closes it. Apps open
 * the current phase chapter by chapter and keep the others to one line until asked, so the screen
 * stays calm however big the goal is.
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
    const inPhase = items.filter((item) => item.phase === index);
    const lessons = inPhase.filter((item) => item.kind === "lesson");
    const minutes = getPhaseMinutes({ estimateMinutes, index, items, phase });

    return {
      chapterCount: new Set(lessons.map((item) => getGroupKey({ item, skillAreas }))).size,
      chapters: buildChapters({
        chapterTitles,
        isCurrent: index === currentPhase,
        lessons,
        skillAreas,
      }),
      checkpoint: buildCheckpoint(inPhase),
      endDate: phase.endDate,
      hours: Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10,
      index,
      kind: phase.kind,
      lessonsDone: lessons.filter((item) => isFinished(item.status)).length,
      lessonsTotal: lessons.length,
      milestone: phase.milestone,
      mocks: buildMocks(inPhase),
      name: phase.name,
      short: toShortPhaseView({ phase, shape: shortPlan }),
      startDate: phase.startDate,
      state: getProgressState({ current: currentPhase, index }),
    };
  });
}
