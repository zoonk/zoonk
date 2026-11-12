import { type SavedMindMapKind } from "@zoonk/db";
import { type GoalMindMapView, type SavedMindMapView } from "../mind-map-contract";
import { type MindMapChapterFacts } from "./load-mind-map-chapters";
import { type ScopeLessonMap } from "./scope-lesson-maps";

type SavedRow = { goalId: string; kind: SavedMindMapKind; targetId: string; title: string };

export function toSavedKey({ kind, targetId }: Pick<SavedRow, "kind" | "targetId">): string {
  return `${kind}:${targetId}`;
}

export function toSavedKeys(rows: readonly Pick<SavedRow, "kind" | "targetId">[]): Set<string> {
  return new Set(rows.map((row) => toSavedKey(row)));
}

function listOpenSaves({
  chapter,
  lessonMaps,
  saved,
}: {
  chapter: GoalMindMapView;
  lessonMaps: readonly ScopeLessonMap[];
  saved: ReadonlySet<string>;
}): SavedMindMapView[] {
  const { chapterId } = chapter;
  const isChapterSaved = saved.has(toSavedKey({ kind: "chapter", targetId: chapterId }));

  const chapterSave: SavedMindMapView[] =
    chapter.status === "ready" && isChapterSaved
      ? [{ available: true, chapterId, kind: "chapter", targetId: chapterId, title: chapter.title }]
      : [];

  const lessonSaves = lessonMaps
    .filter(
      (map) => !map.locked && saved.has(toSavedKey({ kind: "lesson", targetId: map.lessonId })),
    )
    .map((map) => ({
      available: true,
      chapterId,
      kind: "lesson" as const,
      targetId: map.lessonId,
      title: map.title,
    }));

  return [...chapterSave, ...lessonSaves];
}

/** The chapter of the scope a saved map belongs to, when one does. */
function findScopeChapter({
  facts,
  row,
}: {
  facts: readonly Pick<MindMapChapterFacts, "chapterId" | "lessonIds">[];
  row: Pick<SavedRow, "kind" | "targetId">;
}): string | null {
  const chapter = facts.find((candidate) =>
    row.kind === "chapter"
      ? candidate.chapterId === row.targetId
      : candidate.lessonIds.includes(row.targetId),
  );

  return chapter?.chapterId ?? null;
}

/**
 * The Saved tab: saves that open now in syllabus order, then those of this goal's scope or saved
 * from this goal that no longer open, newest first, under their saved titles. Saves from other
 * goals outside this scope aren't listed.
 */
export function toSavedMindMaps({
  chapters,
  facts,
  goalId,
  lessonMaps,
  savedRows,
}: {
  chapters: readonly GoalMindMapView[];
  facts: readonly Pick<MindMapChapterFacts, "chapterId" | "lessonIds">[];
  goalId: string;
  /** Each lesson under one chapter. */
  lessonMaps: ReadonlyMap<string, ScopeLessonMap[]>;
  /** Oldest first. */
  savedRows: readonly SavedRow[];
}): SavedMindMapView[] {
  const shown = savedRows
    .map((row) => ({ chapterId: findScopeChapter({ facts, row }), row }))
    .filter(({ chapterId, row }) => chapterId !== null || row.goalId === goalId);

  const saved = toSavedKeys(shown.map(({ row }) => row));

  const open = chapters.flatMap((chapter) =>
    listOpenSaves({ chapter, lessonMaps: lessonMaps.get(chapter.chapterId) ?? [], saved }),
  );

  const opens = toSavedKeys(open);

  const closed = shown
    .filter(({ row }) => !opens.has(toSavedKey(row)))
    .toReversed()
    .map(({ chapterId, row }) => ({
      available: false,
      chapterId,
      kind: row.kind,
      targetId: row.targetId,
      title: row.title,
    }));

  return [...open, ...closed];
}
