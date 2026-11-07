import "server-only";
import { type Goal, prisma, sql } from "@zoonk/db";
import {
  type MindMapChapterRow,
  mindMapChapterRows,
  toMindMapRow,
} from "./listed-mind-map-chapters";
import { type MindMapRow } from "./mind-map-view";

export type MindMapChapterFacts = {
  /** Finished by study or test-out; never a language unit. */
  canHaveMap: boolean;
  chapterId: string;
  hasWrittenLessons: boolean;
  /** Internal plan order; display numbering must use loadChapterNumbering. */
  position: number;
  row: MindMapRow | null;
  title: string;
};

/** Returns only visible chapters, in saved plan order. */
export async function loadMindMapChapters({
  chapterIds,
  goal,
}: {
  chapterIds?: readonly string[];
  goal: Pick<Goal, "id">;
}): Promise<MindMapChapterFacts[]> {
  const only = chapterIds ? sql`WHERE m."chapterId" = ANY(${[...chapterIds]}::uuid[])` : sql``;

  const chapters = await prisma.$queryRaw<MindMapChapterRow[]>`
    SELECT * FROM (${mindMapChapterRows(sql`g.id = ${goal.id}::uuid`)}) m
    ${only}
    ORDER BY m.position`;

  return chapters.map((chapter) => ({
    canHaveMap: chapter.canHaveMap,
    chapterId: chapter.chapterId,
    hasWrittenLessons: chapter.hasWrittenLessons,
    position: chapter.position,
    row: toMindMapRow(chapter),
    title: chapter.title,
  }));
}
