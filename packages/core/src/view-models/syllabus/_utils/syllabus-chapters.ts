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

/** A chapter with the key its lessons are grouped by, so topics can point at it. */
export type KeyedChapter = SyllabusChapter & { key: string };

export function getEarliestTodoDate(items: readonly SyllabusItem[]): string | null {
  const dates = items.flatMap((item) =>
    item.status === "todo" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
  );

  return dates.toSorted()[0] ?? null;
}

/**
 * A row per chapter, counting the lessons its page lists. Lessons still being written (or settled
 * before they were) are their skill's own row: they become its next chapter once outlined, so
 * counting them in the chapter that teaches the skill first said "4 of 10" over Sofia's chapter
 * of nine lessons.
 */
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

/** A chapter before the subject's order gives it its number. */
type UnnumberedChapter = Omit<KeyedChapter, "position">;

/** The ones done first, then in the order the plan gets to them; ones not scheduled last. */
function compareChapters(first: UnnumberedChapter, second: UnnumberedChapter): number {
  const rank = (chapter: UnnumberedChapter) => {
    if (chapter.state === "done") {
      return "0";
    }

    return chapter.nextDate ? `1${chapter.nextDate}` : "2";
  };

  return rank(first).localeCompare(rank(second));
}

/**
 * A subject's chapters: the ones done, then in the order the plan studies them next, each numbered
 * in that order (the number every screen gives it), with lessons done of the total, whether the
 * learner only showed they know it (`known`), and the one holding the plan's next lesson. Skills without a chapter yet are named by the skill, with the
 * lessons the plan expects for them (`lessonsOf`), whether they start after the weeks the plan
 * writes ahead (`outlinedUntil`), and then the skill to ask for them by, unless chapters already
 * teach it (`taughtSkillIds`).
 */
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

/** Each lesson's area: its skill's, or, for a lesson without one, its chapter's. */
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
