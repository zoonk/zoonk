import { type NextMockMove } from "./next-mock-move";
import { daysBetween, fromIsoDate, toIsoDate } from "./plan-calendar";
import { SMALL_CHANGE_DAYS, SMALL_CHANGE_LESSONS } from "./plan-change-thresholds";
import { isUnwrittenLesson } from "./plan-item-rules";
import { type PlannedItem } from "./plan-items";
import { type PlanGraph } from "./plan-state";
import { type SkillMinutes } from "./skill-minutes";
import { getTopicChanges } from "./topic-changes";

export type EffectItem = Pick<
  PlannedItem,
  "chapterId" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId" | "status"
> & { id: string | null };

export type AreaStart = { after: string | null; area: string; before: string | null };

export type AreaEnd = { after: string; area: string; before: string; lessonsGained?: number };

export type AreaLessons = { after: number; area: string; before: number };

type UnwrittenLeftOut = { lessons: number; skill: string };

export type AreaTopics = { area: string; topics: string[] };

export type WeeklyEventMove = { after: number; before: number; kind: "challenge" | "mock" };

type ReviewFirst = { areas: string[]; date: string };

export type PhaseEndMove = {
  after: string;
  before: string;
  lessonsFirst?: true;
  name: string;
  restDay?: true;
};

export type PlanEffect = {
  addedTopicsBeforeBasics?: true;
  addedTopicsStart?: string;
  areaEnds?: AreaEnd[];
  areaLessons?: AreaLessons[];
  areaStarts?: AreaStart[];
  fromPlacement?: true;
  reviewFirst?: ReviewFirst;
  endDateAfter: string | null;
  endDateBefore: string | null;
  lessonsAdded: number;
  lessonsAddedEstimated?: true;
  lessonsLeftOut?: string[];
  lessonsRemoved: number;
  listeningPastBasics?: string[];
  nextMock?: NextMockMove;
  outcomesAdded?: string[];
  phaseEnds?: PhaseEndMove[];
  topicsAdded?: AreaTopics[];
  topicsLeftOut?: AreaTopics[];
  unwrittenLeftOut?: UnwrittenLeftOut[];
  weeklyEvents?: WeeklyEventMove;
};

function getEndDate(items: readonly Pick<EffectItem, "scheduledFor" | "status">[]): string | null {
  const last = items
    .filter((item) => item.status === "todo" && item.scheduledFor)
    .map((item) => item.scheduledFor?.getTime() ?? 0)
    .reduce((latest, time) => Math.max(latest, time), 0);

  return last > 0 ? toIsoDate(new Date(last)) : null;
}

function countGained({ from, to }: { from: Map<string, number>; to: Map<string, number> }) {
  return [...from].reduce(
    (total, [key, lessons]) => total + Math.max(0, lessons - (to.get(key) ?? 0)),
    0,
  );
}

function gainsStandIns({
  from,
  standIns,
  to,
}: {
  from: Map<string, number>;
  standIns: ReadonlySet<string>;
  to: Map<string, number>;
}): Pick<PlanEffect, "lessonsAddedEstimated"> {
  const estimated = [...from].some(
    ([key, lessons]) => standIns.has(key) && lessons > (to.get(key) ?? 0),
  );

  return estimated ? { lessonsAddedEstimated: true } : {};
}

function getCoveredShare(skill: SkillMinutes): number {
  const { covered, total } = skill.standIn ?? skill;
  return total > 0 ? covered / total : 1;
}

export function getFittedStandInLessons({
  skillMinutes,
  standInLessons,
}: {
  skillMinutes: readonly SkillMinutes[];
  standInLessons: ReadonlyMap<string, number>;
}): Map<string, number> {
  const shares = new Map(skillMinutes.map((skill) => [skill.skillId, getCoveredShare(skill)]));

  return new Map(
    [...standInLessons].map(([skillId, lessons]) => [
      skillId,
      Math.max(1, Math.round(lessons * (shares.get(skillId) ?? 1))),
    ]),
  );
}

export function getAddedSkillsStart({
  items,
  skillIds,
}: {
  items: readonly EffectItem[];
  skillIds: ReadonlySet<string>;
}): string | null {
  const dates = items.flatMap((item) =>
    item.status === "todo" && item.scheduledFor && skillIds.has(item.skillId ?? "")
      ? [item.scheduledFor.getTime()]
      : [],
  );

  return dates.length > 0 ? toIsoDate(new Date(Math.min(...dates))) : null;
}

export function startsBeforeBasics({
  items,
  skillIds,
}: {
  items: readonly EffectItem[];
  skillIds: ReadonlySet<string>;
}): boolean {
  const lessons = items.filter((item) => item.status === "todo" && item.kind === "lesson");
  const added = lessons.findIndex((item) => skillIds.has(item.skillId ?? ""));

  const basics = lessons.findIndex((item) => item.phase === 0 && !skillIds.has(item.skillId ?? ""));

  return added !== -1 && basics !== -1 && added < basics;
}

type SeenItem = Pick<EffectItem, "chapterId" | "kind" | "lessonId" | "skillId" | "status"> & {
  lessons?: number | null;
  titleSnapshot: string;
};

function countSkillLessons({
  items,
  lessonsOf,
}: {
  items: readonly SeenItem[];
  lessonsOf: (item: SeenItem) => number;
}): Map<string, number> {
  return items
    .filter((item) => item.status === "todo" && item.kind === "lesson")
    .reduce(
      (skills, item) =>
        skills.set(item.skillId ?? "", (skills.get(item.skillId ?? "") ?? 0) + lessonsOf(item)),
      new Map<string, number>(),
    );
}

function countLessonChanges(
  input: Parameters<typeof countSkillChanges>[0],
): Pick<PlanEffect, "lessonsAdded" | "lessonsAddedEstimated" | "lessonsRemoved"> {
  const { filed, now, was } = countSkillChanges(input);

  const standIns = new Set(
    filed
      .filter((item) => item.status === "todo" && isUnwrittenLesson(item))
      .map((item) => item.skillId ?? ""),
  );

  return {
    lessonsAdded: countGained({ from: now, to: was }),
    ...gainsStandIns({ from: now, standIns, to: was }),
    lessonsRemoved: countGained({ from: was, to: now }),
  };
}

function sumLessons({
  items,
  lessonsOf,
}: {
  items: readonly SeenItem[];
  lessonsOf: (item: SeenItem) => number;
}): number {
  return items.reduce((sum, item) => sum + lessonsOf(item), 0);
}

function countSkillChanges({
  after,
  before,
  lessonsAfter,
  lessonsBefore,
}: {
  after: readonly SeenItem[];
  before: readonly SeenItem[];
  lessonsAfter: (item: SeenItem) => number;
  lessonsBefore: (item: SeenItem) => number;
}) {
  const seenSkills = new Map(
    before.flatMap((item) => (item.lessonId ? [[item.lessonId, item.skillId] as const] : [])),
  );

  const filed = after.map((item) =>
    item.lessonId && seenSkills.has(item.lessonId)
      ? { ...item, skillId: seenSkills.get(item.lessonId) ?? item.skillId }
      : item,
  );

  return {
    filed,
    now: countSkillLessons({ items: filed, lessonsOf: lessonsAfter }),
    was: countSkillLessons({ items: before, lessonsOf: lessonsBefore }),
  };
}

function listUnwrittenLeftOut({
  before,
  graph,
  leftOut,
  ...input
}: Parameters<typeof countSkillChanges>[0] & {
  graph: PlanGraph;
  leftOut: ReadonlySet<string>;
}): UnwrittenLeftOut[] {
  const { now, was } = countSkillChanges({ before, ...input });
  const names = new Map(graph.skills.map((skill) => [skill.skillId, skill.name]));

  const named = Map.groupBy(
    before.filter(
      (item) => item.kind === "lesson" && item.status === "todo" && leftOut.has(item.titleSnapshot),
    ),
    (item) => item.skillId ?? "",
  );

  return [...was].flatMap(([skillId, lessons]) => {
    const removed = Math.max(0, lessons - (now.get(skillId) ?? 0));
    const said = sumLessons({ items: named.get(skillId) ?? [], lessonsOf: input.lessonsBefore });
    const unnamed = removed - said;
    const skill = names.get(skillId);

    return unnamed > 0 && skill ? [{ lessons: unnamed, skill }] : [];
  });
}

function listLessonsLeftOut({
  after,
  before,
}: {
  after: readonly SeenItem[];
  before: readonly SeenItem[];
}): string[] {
  const lessons = after.filter((item) => item.kind === "lesson" && item.status !== "skipped");
  const lessonIds = new Set(lessons.flatMap((item) => (item.lessonId ? [item.lessonId] : [])));
  const skillIds = new Set(lessons.flatMap((item) => (item.skillId ? [item.skillId] : [])));

  return before
    .filter((item) => item.kind === "lesson" && item.status === "todo")
    .filter((item) =>
      item.lessonId ? !lessonIds.has(item.lessonId) : !skillIds.has(item.skillId ?? ""),
    )
    .map((item) => item.titleSnapshot);
}

export function getSeenChange({
  after,
  before,
  graph,
  lessonsAfter,
  lessonsBefore,
}: {
  after: readonly (SeenItem & Pick<EffectItem, "scheduledFor">)[];
  before: readonly (SeenItem & Pick<EffectItem, "scheduledFor">)[];
  graph: PlanGraph;
  lessonsAfter: (item: SeenItem) => number;
  lessonsBefore: (item: SeenItem) => number;
}): Pick<
  PlanEffect,
  | "endDateAfter"
  | "endDateBefore"
  | "lessonsAdded"
  | "lessonsAddedEstimated"
  | "lessonsLeftOut"
  | "lessonsRemoved"
  | "topicsAdded"
  | "topicsLeftOut"
  | "unwrittenLeftOut"
> {
  const lessonsLeftOut = listLessonsLeftOut({ after, before });
  const { topicsAdded, topicsLeftOut } = getTopicChanges({ after, before, graph });
  const counters = { after, before, lessonsAfter, lessonsBefore };

  const unwrittenLeftOut = listUnwrittenLeftOut({
    ...counters,
    graph,
    leftOut: new Set(lessonsLeftOut),
  });

  return {
    endDateAfter: getEndDate(after),
    endDateBefore: getEndDate(before),
    ...countLessonChanges(counters),
    ...(lessonsLeftOut.length > 0 && { lessonsLeftOut }),
    ...(unwrittenLeftOut.length > 0 && { unwrittenLeftOut }),
    ...(topicsAdded.length > 0 && { topicsAdded }),
    ...(topicsLeftOut.length > 0 && { topicsLeftOut }),
  };
}

export function needsApproval(effect: PlanEffect): boolean {
  const { endDateAfter, endDateBefore } = effect;

  const shift =
    endDateAfter && endDateBefore
      ? Math.abs(daysBetween(fromIsoDate(endDateBefore), fromIsoDate(endDateAfter)))
      : Number(endDateAfter !== endDateBefore) * (SMALL_CHANGE_DAYS + 1);

  return (
    effect.lessonsAdded + effect.lessonsRemoved > SMALL_CHANGE_LESSONS || shift > SMALL_CHANGE_DAYS
  );
}
