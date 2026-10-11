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
import {
  countItemLessons,
  getOpenEarlySkill,
  isFarTopic,
  sumPlannedLessons,
} from "./stand-in-lessons";
import { countLessonProgress, getWorkProgress, isWorkFinished } from "./work-progress";

const MINUTES_PER_HOUR = 60;

const isTodo = (status: PlanItemStatus) => getWorkProgress(status) === "todo";

const isTestedOut = (item: Pick<ExistingPlanItem, "status">) =>
  getWorkProgress(item.status) === "testedOut";

type PhaseItem = Pick<ExistingPlanItem, "chapterId" | "kind" | "lessonId" | "phase" | "status">;

/** What a phase's work is: its lessons, written or still being written, and its challenge. */
export const PHASE_WORK_KINDS = new Set<PhaseItem["kind"]>(["boss", "chapter", "lesson"]);

/**
 * The phase the learner is in, the same on Plan, on the map, on Today and on the exam page: the
 * earliest phase with work left, its challenge included, or the last phase once everything is done.
 * A later phase's lesson the plan gives first doesn't move the learner on: read from the next thing
 * to do, Pedro's Journey said he was in the second phase, and went back to the first once a change
 * planned that phase's last lessons first (see `loadCurrentPhases`, its SQL twin).
 */
export function findCurrentPhase({
  items,
  phaseCount,
}: {
  items: readonly PhaseItem[];
  phaseCount: number;
}): number | null {
  const left = items.flatMap((item) =>
    item.status === "todo" && PHASE_WORK_KINDS.has(item.kind) ? [item.phase] : [],
  );

  if (left.length > 0) {
    return Math.min(...left);
  }

  return phaseCount > 0 && items.length > 0 ? phaseCount - 1 : null;
}

/**
 * The learner finished a phase's work: every lesson and its challenge studied, won or tested out.
 * One whose work was set aside isn't, though the plan moved past it: Rafaela's first phase, one
 * lesson studied before 30 days away set the rest aside, read "done" on her Journey.
 */
export function isPhaseFinished(items: readonly Pick<PhaseItem, "kind" | "status">[]): boolean {
  return items.every((item) => !PHASE_WORK_KINDS.has(item.kind) || isWorkFinished(item.status));
}

/** Each skill's area: the course a stand-in for its lessons is shown under. */
export type SkillAreas = ReadonlyMap<string, string | null>;

/**
 * Each skill's area to show its stand-ins under (see `getWritingTitle`). The goal's own course (a
 * learn goal's, a language) says nothing the goal doesn't, so its skills have none and apps say
 * "More lessons": every phase of Maya's plan had a row named after her goal.
 */
export function getSkillAreas({
  courseTitle,
  skills,
}: {
  courseTitle: string | null;
  skills: readonly { area: string | null; skillId: string }[];
}): SkillAreas {
  return new Map(
    skills.map((skill) => [skill.skillId, skill.area === courseTitle ? null : skill.area]),
  );
}

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
  return isTestedOut(item) ? `settled:${title}` : `writing:${title}`;
}

/**
 * The skills a row of settled stand-ins stands for, by name in plan order: placement tested them
 * out before their lessons were written, so the row names them rather than their course.
 */
function getSettledSkills(inGroup: readonly ExistingPlanItem[]): string[] {
  const [first] = inGroup;

  if (!first || !isWritingItem(first) || !isTestedOut(first)) {
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
 * A phase chapter by chapter, in plan order: lessons done of the total, and which one the learner
 * is in: the one holding the lesson up next (`findUpNextItem`), in whichever phase, as on Today and
 * the map. Skills whose lessons aren't outlined yet group under their course as one `writing` row
 * until their chapters exist; the ones placement tested out before then are one finished row of
 * their own.
 */
function buildChapters({
  chapterTitles,
  isEarlier,
  lessons,
  lessonsOf,
  outlinedUntil,
  skillAreas,
  taughtSkillIds,
  upNextItemId,
}: {
  chapterTitles: ReadonlyMap<string, string>;
  /** The skill belongs to an earlier phase than this one (see `PlanChapterView.deeper`). */
  isEarlier: (skillId: string | null) => boolean;
  lessons: readonly ExistingPlanItem[];
  /** How many lessons each item is (`countItemLessons`): a stand-in, the ones the plan teaches. */
  lessonsOf: (item: ExistingPlanItem) => number;
  outlinedUntil: string | null;
  skillAreas: SkillAreas;
  taughtSkillIds: ReadonlySet<string>;
  upNextItemId: string | null;
}): PlanChapterView[] {
  const keys = [...new Set(lessons.map((item) => getGroupKey({ item, skillAreas })))];

  const sum = (list: readonly ExistingPlanItem[]) =>
    list.reduce((total, item) => total + lessonsOf(item), 0);

  const groups = keys.flatMap((key) => {
    const inGroup = lessons.filter((item) => getGroupKey({ item, skillAreas }) === key);
    const [first] = inGroup;

    if (!first) {
      return [];
    }

    const todo = inGroup.filter((item) => isTodo(item.status));
    const writing = isWritingItem(first) && todo.length > 0;
    const nextDate = getEarliestDate(todo);
    const far = isFarTopic({ nextDate, outlinedUntil, writing });

    return {
      chapterId: first.chapterId,
      deeper: inGroup.every((item) => isEarlier(item.skillId)),
      far,
      key,
      lessonsDone: sum(inGroup.filter((item) => isWorkFinished(item.status))),
      lessonsTotal: sum(inGroup),
      nextDate,
      plannedLessons: writing ? sumPlannedLessons(inGroup) : null,
      skillId: getOpenEarlySkill({
        far,
        skillIds: todo.map((item) => item.skillId),
        taughtSkillIds,
      }),
      skills: getSettledSkills(inGroup),
      testedOut: inGroup.every((item) => isTestedOut(item)),
      title: getChapterTitle({ chapterTitles, item: first, skillAreas }),
      writing,
    };
  });

  const next = lessons.find((item) => item.id === upNextItemId);
  const currentKey = next ? getGroupKey({ item: next, skillAreas }) : null;

  /** A chapter finished ahead of the current one (lessons often interleave) still reads as done. */
  return groups.map(({ key, ...group }) => {
    if (group.lessonsDone === group.lessonsTotal) {
      return { ...group, state: "done" as const };
    }

    return { ...group, state: key === currentKey ? ("current" as const) : ("upcoming" as const) };
  });
}

/** The earliest day the items are scheduled; null when none is. */
function getEarliestDate(items: readonly ExistingPlanItem[]): string | null {
  const dates = items.flatMap((item) => (item.scheduledFor ? [toIsoDate(item.scheduledFor)] : []));
  return dates.toSorted()[0] ?? null;
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
    state: isWorkFinished(boss.status) ? "done" : "upcoming",
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

/**
 * Where a phase stands against the current one; every one is done without one. One the plan
 * moved past is done only once the learner finished its work (`isPhaseFinished`): with work set
 * aside it's `unfinished`.
 */
export function getProgressState({
  current,
  finished,
  index,
}: {
  current: number | null;
  finished: boolean;
  index: number;
}) {
  if (current === null || index < current) {
    return finished ? ("done" as const) : ("unfinished" as const);
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
  outlinedUntil = null,
  phases,
  shortPlan = null,
  skillAreas,
  skillPhases = new Map(),
  taughtSkillIds = new Set(),
  upNextItemId,
}: {
  chapterTitles: ReadonlyMap<string, string>;
  currentPhase: number | null;
  /** The whole plan's estimate, for phases saved without their own minutes. */
  estimateMinutes?: number | null;
  items: readonly ExistingPlanItem[];
  /** How far ahead the plan writes lessons (`getOutlinedUntil`): topics after it open early. */
  outlinedUntil?: string | null;
  phases: readonly PlanPhase[];
  /** A test days away: its phases say which of its days they cover. */
  shortPlan?: ShortPlanShape | null;
  skillAreas: SkillAreas;
  /** Each skill's phase in the graph: a learn phase's rows of earlier phases' skills go deeper. */
  skillPhases?: ReadonlyMap<string, number>;
  /** Stand-in skills chapters already teach (`listTaughtStandInSkills`): none to ask for early. */
  taughtSkillIds?: ReadonlySet<string>;
  /** The plan item of the lesson up next (`findUpNextItem`): its chapter is the current one. */
  upNextItemId: string | null;
}): PlanPhaseView[] {
  return phases.map((phase, index) => {
    const inPhase = items.filter((item) => item.phase === index);
    const lessons = inPhase.filter((item) => item.kind === "lesson");
    const minutes = getPhaseMinutes({ estimateMinutes, index, items, phase });

    return {
      chapterCount: new Set(lessons.map((item) => getGroupKey({ item, skillAreas }))).size,
      chapters: buildChapters({
        chapterTitles,
        isEarlier: (skillId) =>
          phase.kind === "learn" && skillId !== null && (skillPhases.get(skillId) ?? index) < index,
        lessons,
        lessonsOf: countItemLessons,
        outlinedUntil,
        skillAreas,
        taughtSkillIds,
        upNextItemId,
      }),
      checkpoint: buildCheckpoint(inPhase),
      endDate: phase.endDate,
      hours: Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10,
      index,
      kind: phase.kind,
      ...countLessonProgress(lessons),
      milestone: phase.milestone,
      mocks: buildMocks(inPhase),
      name: phase.name,
      short: toShortPhaseView({ phase, shape: shortPlan }),
      startDate: phase.startDate,
      state: getProgressState({ current: currentPhase, finished: isPhaseFinished(inPhase), index }),
    };
  });
}
