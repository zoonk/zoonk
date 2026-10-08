import { type PlanItemStatus } from "@zoonk/db";
import { isWritingItem } from "../../../plans/_utils/plan-phase-views";
import { toIsoDate } from "../../../plans/planner/plan-calendar";
import { type SyllabusChapter } from "../syllabus-contract";
import { type SyllabusItem, type SyllabusSkill } from "./syllabus-input";

/** A chapter with the key its lessons are grouped by, so topics can point at it. */
export type KeyedChapter = SyllabusChapter & { key: string };

export type ChapterKeyOf = (item: SyllabusItem) => string;

export function isFinished(status: PlanItemStatus): boolean {
  return status !== "todo";
}

export function getEarliestTodoDate(items: readonly SyllabusItem[]): string | null {
  const dates = items.flatMap((item) =>
    item.status === "todo" && item.scheduledFor ? [toIsoDate(item.scheduledFor)] : [],
  );

  return dates.toSorted()[0] ?? null;
}

/**
 * A row per chapter. Lessons still being written (or settled before they were) join the chapter
 * that already teaches their skill, since they're more of it; a skill without one is its own row.
 */
export function getChapterKeyOf(items: readonly SyllabusItem[]): ChapterKeyOf {
  const skillChapters = new Map(
    items
      .flatMap((item) =>
        item.chapterId && item.skillId ? [[item.skillId, item.chapterId] as const] : [],
      )
      .toReversed(),
  );

  return function chapterKeyOf(item) {
    return (
      item.chapterId ??
      (item.skillId ? skillChapters.get(item.skillId) : undefined) ??
      `skill:${item.skillId ?? item.titleSnapshot}`
    );
  };
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
 * in that order (the number every screen gives it), with lessons done of the total and the one
 * holding the plan's next lesson. Skills without a chapter yet are named by the skill.
 */
export function buildChapters({
  chapterKeyOf,
  chapterTitles,
  items,
  nextKey,
  skillNames,
}: {
  chapterKeyOf: ChapterKeyOf;
  chapterTitles: ReadonlyMap<string, string>;
  items: readonly SyllabusItem[];
  nextKey: string | null;
  skillNames: ReadonlyMap<string, string>;
}): KeyedChapter[] {
  const keys = [...new Set(items.map((item) => chapterKeyOf(item)))];

  const chapters = keys.flatMap((key): UnnumberedChapter[] => {
    const inChapter = items.filter((item) => chapterKeyOf(item) === key);
    const written = inChapter.find((item) => item.chapterId);
    const [first] = inChapter;

    if (!first) {
      return [];
    }

    const lessonsDone = inChapter.filter((item) => isFinished(item.status)).length;
    const done = lessonsDone === inChapter.length;
    const standInTitle = first.skillId ? skillNames.get(first.skillId) : undefined;

    return [
      {
        chapterId: written?.chapterId ?? null,
        key,
        lessonsDone,
        lessonsTotal: inChapter.length,
        nextDate: getEarliestTodoDate(inChapter),
        state: getChapterState({ done, key, nextKey }),
        title: written?.chapterId
          ? chapterTitles.get(written.chapterId) || written.titleSnapshot
          : standInTitle || first.titleSnapshot,
        writing: !written && isWritingItem(first) && !done,
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
