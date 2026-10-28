import { isWritingItem } from "../../../plans/_utils/plan-phase-views";
import {
  getOpenEarlySkill,
  isFarTopic,
  sumPlannedLessons,
} from "../../../plans/_utils/stand-in-lessons";
import { getWorkProgress, isWorkFinished } from "../../../plans/_utils/work-progress";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { type SyllabusChapter } from "../syllabus-contract";
import { uniquePlanItems } from "./subject-progress";
import { type SyllabusItem, type SyllabusSkill } from "./syllabus-input";

export type KeyedChapter = SyllabusChapter & { key: string };

export function getEarliestTodoDate(items: readonly SyllabusItem[]): string | null {
  const dates = items.flatMap((item) =>
    item.status === "todo" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
  );

  return dates.toSorted()[0] ?? null;
}

/** Unwritten lessons get their own skill row instead of inflating the first chapter that teaches the skill. */
export function chapterKeyOf(item: SyllabusItem): string {
  return item.chapterId ?? `skill:${item.skillId ?? item.titleSnapshot}`;
}

function getChapterState({
  done,
  key,
  nextKey,
}: {
  done: boolean;
  key: string;
  nextKey: string | null;
}): SyllabusChapter["state"] {
  if (done) {
    return "done";
  }

  return key === nextKey ? "current" : "upcoming";
}

type UnnumberedChapter = Omit<KeyedChapter, "position">;

function compareChapters(first: UnnumberedChapter, second: UnnumberedChapter): number {
  const rank = (chapter: UnnumberedChapter) => {
    if (chapter.state === "done") {
      return "0";
    }

    return chapter.nextDate ? `1${chapter.nextDate}` : "2";
  };

  return rank(first).localeCompare(rank(second));
}

/** Order completed chapters first, then scheduled work; unwritten skills can be requested early only beyond outlinedUntil and when untaught. */
export function buildChapters({
  chapterTitles,
  items,
  lessonsOf,
  nextKey,
  outlinedUntil,
  skillNames,
  taughtSkillIds,
}: {
  chapterTitles: ReadonlyMap<string, string>;
  items: readonly SyllabusItem[];
  /** How many lessons each item is (`countItemLessons`): a stand-in, the ones the plan teaches. */
  lessonsOf: (item: SyllabusItem) => number;
  nextKey: string | null;
  outlinedUntil?: string | null;
  skillNames: ReadonlyMap<string, string>;
  taughtSkillIds: ReadonlySet<string>;
}): KeyedChapter[] {
  const keys = [...new Set(items.map((item) => chapterKeyOf(item)))];

  const sum = (list: readonly SyllabusItem[]) =>
    uniquePlanItems(list).reduce((total, item) => total + lessonsOf(item), 0);

  const chapters = keys.flatMap((key): UnnumberedChapter[] => {
    const inChapter = items.filter((item) => chapterKeyOf(item) === key);
    const written = inChapter.find((item) => item.chapterId);
    const [first] = inChapter;

    if (!first) {
      return [];
    }

    const finished = inChapter.filter((item) => isWorkFinished(item.status));
    const done = finished.length === inChapter.length;
    const standInTitle = first.skillId ? skillNames.get(first.skillId) : undefined;
    const writing = !written && isWritingItem(first) && !done;
    const nextDate = getEarliestTodoDate(inChapter);
    const far = isFarTopic({ nextDate, outlinedUntil, writing });

    return [
      {
        chapterId: written?.chapterId ?? null,
        far,
        key,
        known: done && inChapter.every((item) => getWorkProgress(item.status) === "testedOut"),
        lessonsDone: sum(finished),
        lessonsTotal: sum(inChapter),
        nextDate,
        plannedLessons: writing ? sumPlannedLessons(inChapter) : null,
        skillId: getOpenEarlySkill({ far, skillIds: [first.skillId], taughtSkillIds }),
        state: getChapterState({ done, key, nextKey }),
        title: written?.chapterId
          ? chapterTitles.get(written.chapterId) || written.titleSnapshot
          : standInTitle || first.titleSnapshot,
        writing,
      },
    ];
  });

  return chapters
    .toSorted(compareChapters)
    .map((chapter, index) => ({ ...chapter, position: index + 1 }));
}

export function withoutKey({ key: _key, ...chapter }: KeyedChapter): SyllabusChapter {
  return chapter;
}

export function getItemAreas({
  items,
  skills,
}: {
  items: readonly SyllabusItem[];
  skills: readonly SyllabusSkill[];
}): (item: SyllabusItem) => string | null {
  const skillAreas = new Map(skills.map((skill) => [skill.skillId, skill.area]));
  const areaOf = (item: SyllabusItem) => (item.skillId ? skillAreas.get(item.skillId) : undefined);

  const chapterAreas = new Map(
    items
      .flatMap((item) => {
        const area = areaOf(item);
        return item.chapterId && area ? [[item.chapterId, area] as const] : [];
      })
      .toReversed(),
  );

  return function itemArea(item) {
    return areaOf(item) ?? (item.chapterId ? chapterAreas.get(item.chapterId) : undefined) ?? null;
  };
}
