import { type Goal, type PlanItemStatus } from "@zoonk/db";
import { getBossTimings } from "../../checkpoints/_utils/boss-reached";
import { type PlanChapterView, type PlanPhaseView } from "../plan-view-contract";
import { toIsoDate } from "../planner/plan-calendar";
import { isWritingItem } from "../planner/plan-item-rules";
import { type PlanPhase } from "../planner/plan-state";
import { buildCheckpoint } from "./phase-checkpoint";
import { getPhaseStates } from "./phase-states";
import { hasPlanDeadline, withinLessonScope } from "./plan-end";
import { type PlanReadItem, getPlanReadItemKey } from "./plan-read-projection";
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

const isTestedOut = (item: Pick<PlanReadItem, "status">) =>
  getWorkProgress(item.status) === "testedOut";

export type SkillAreas = ReadonlyMap<string, string | null>;

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

export function getWritingTitle({
  item,
  skillAreas,
}: {
  item: Pick<PlanReadItem, "skillId">;
  skillAreas: SkillAreas;
}): string {
  return (item.skillId && skillAreas.get(item.skillId)) || "";
}

function getGroupKey({ item, skillAreas }: { item: PlanReadItem; skillAreas: SkillAreas }) {
  if (item.chapterId) {
    return item.chapterId;
  }

  if (!isWritingItem(item)) {
    return `item:${item.skillId ?? item.id}`;
  }

  const title = getWritingTitle({ item, skillAreas });
  return isTestedOut(item) ? `settled:${title}` : `writing:${title}`;
}

function getSettledSkills(inGroup: readonly PlanReadItem[]): string[] {
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
  item: PlanReadItem;
  skillAreas: SkillAreas;
}): string {
  if (item.chapterId) {
    return chapterTitles.get(item.chapterId) || item.titleSnapshot;
  }

  return isWritingItem(item) ? getWritingTitle({ item, skillAreas }) : item.titleSnapshot;
}

function buildChapters({
  chapterTitles,
  isEarlier,
  lessons,
  lessonsOf,
  outlinedUntil,
  skillAreas,
  taughtSkillIds,
  today,
  todayItemKeys,
  upNextItemId,
}: {
  chapterTitles: ReadonlyMap<string, string>;
  isEarlier: (skillId: string | null) => boolean;
  lessons: readonly PlanReadItem[];
  lessonsOf: (item: PlanReadItem) => number;
  outlinedUntil: string | null;
  skillAreas: SkillAreas;
  taughtSkillIds: ReadonlySet<string>;
  today: Date | null;
  todayItemKeys: ReadonlySet<string>;
  upNextItemId: string | null;
}): PlanChapterView[] {
  const keys = [...new Set(lessons.map((item) => getGroupKey({ item, skillAreas })))];

  const sum = (list: readonly PlanReadItem[]) =>
    list.reduce((total, item) => total + lessonsOf(item), 0);

  const groups = keys.flatMap((key) => {
    const inGroup = lessons.filter((item) => getGroupKey({ item, skillAreas }) === key);
    const [first] = inGroup;

    if (!first) {
      return [];
    }

    const todo = inGroup.filter((item) => isTodo(item.status));
    const writing = isWritingItem(first) && todo.length > 0;

    const nextDate = getEarliestDate(
      todo.map((item) =>
        today && todayItemKeys.has(getPlanReadItemKey(item))
          ? { ...item, scheduledFor: today }
          : item,
      ),
    );

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

  const next =
    upNextItemId === null
      ? undefined
      : lessons.find(
          (item) => item.id === upNextItemId || getPlanReadItemKey(item) === upNextItemId,
        );

  const currentKey = next ? getGroupKey({ item: next, skillAreas }) : null;

  return groups.map(({ key, ...group }) => {
    if (group.lessonsDone === group.lessonsTotal) {
      return { ...group, state: "done" as const };
    }

    return { ...group, state: key === currentKey ? ("current" as const) : ("upcoming" as const) };
  });
}

function getEarliestDate(items: readonly PlanReadItem[]): string | null {
  const dates = items.flatMap((item) => (item.scheduledFor ? [toIsoDate(item.scheduledFor)] : []));
  return dates.toSorted()[0] ?? null;
}

function buildMocks(items: readonly PlanReadItem[]): PlanPhaseView["mocks"] {
  const mocks = items.filter((item) => item.kind === "mock");

  const next = mocks
    .flatMap((item) =>
      item.status === "todo" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
    )
    .toSorted()[0];

  return { count: mocks.length, nextDate: next ?? null };
}

function getPhaseMinutes({
  estimateMinutes,
  index,
  items,
  phase,
}: {
  estimateMinutes: number | null;
  index: number;
  items: readonly PlanReadItem[];
  phase: PlanPhase;
}): number {
  const lessons = items.filter((item) => item.kind === "lesson");

  if (phase.minutes > 0 || !estimateMinutes || lessons.length === 0) {
    return phase.minutes;
  }

  const inPhase = lessons.filter((item) => item.phase === index).length;
  return (estimateMinutes * inPhase) / lessons.length;
}

export function buildPhaseViews({
  phaseChallengesRequired = true,
  challengesOpen = true,
  chapterTitles,
  currentPhase,
  estimateMinutes = null,
  goalKind,
  items: planItems,
  outlinedUntil = null,
  phases,
  shortPlan = null,
  skillAreas,
  skillPhases = new Map(),
  studiesPastTarget = false,
  targetDate = null,
  taughtSkillIds = new Set(),
  today = null,
  todayItemKeys = new Set(),
  upNextItemId,
}: {
  phaseChallengesRequired?: boolean;
  challengesOpen?: boolean;
  chapterTitles: ReadonlyMap<string, string>;
  currentPhase: number | null;
  estimateMinutes?: number | null;
  goalKind: Goal["kind"];
  items: readonly PlanReadItem[];
  outlinedUntil?: string | null;
  phases: readonly PlanPhase[];
  shortPlan?: ShortPlanShape | null;
  skillAreas: SkillAreas;
  skillPhases?: ReadonlyMap<string, number>;
  studiesPastTarget?: boolean;
  targetDate?: Date | null;
  taughtSkillIds?: ReadonlySet<string>;
  today?: Date | null;
  todayItemKeys?: ReadonlySet<string>;
  upNextItemId: string | null;
}): PlanPhaseView[] {
  const deadline = hasPlanDeadline({ studiesPastTarget, targetDate });
  const items = withinLessonScope({ deadline, items: planItems });

  const states = getPhaseStates({
    currentPhase,
    goalKind,
    items: planItems,
    phaseChallengesRequired,
    phases,
    studiesPastTarget,
    targetDate,
    today,
  });

  const timings =
    challengesOpen && today
      ? getBossTimings({
          items: planItems.map((item) => ({ ...item, id: getPlanReadItemKey(item) })),
          today,
        })
      : new Map();

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
        today,
        todayItemKeys,
        upNextItemId,
      }),
      checkpoint: buildCheckpoint({ items: inPhase, locked: !challengesOpen, timings }),
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
      state: states[index] ?? "upcoming",
    };
  });
}
