import { type Sql, prisma, sql } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import {
  CHAPTER_DOCUMENT,
  COURSE_DOCUMENT,
  EXAM_BLUEPRINT_DOCUMENT,
  IMAGE_SCENE_DOCUMENT,
  LESSON_DOCUMENT,
  SKILL_DOCUMENT,
  SOURCE_DOCUMENT,
} from "./search-documents";
import { type IndexedDocument, toIndexedMatchesSql, toTermMatchesSql } from "./text-search-sql";

/**
 * The plan of one term's search, as identity searches run it, with sequential scans ruled out:
 * only a matching index can serve it.
 */
async function explainTermSearch({
  document,
  filters = sql`TRUE`,
}: {
  document: IndexedDocument;
  filters?: Sql;
}) {
  const matches = toTermMatchesSql({
    language: "en",
    queries: ["(percent & discount)"],
    select: (query) =>
      sql`SELECT ${document.alias}.id FROM ${toIndexedMatchesSql({ document, query })} WHERE ${filters}`,
  });

  const [, plan] = await prisma.$transaction([
    prisma.$executeRaw`SET LOCAL enable_seqscan = off`,
    prisma.$queryRaw<{ "QUERY PLAN": string }[]>`EXPLAIN ${matches}`,
  ]);

  return plan.map((row) => row["QUERY PLAN"]).join("\n");
}

describe("search documents", () => {
  it.each([
    { document: SKILL_DOCUMENT, index: "skills_search_idx" },
    { document: CHAPTER_DOCUMENT, index: "library_chapters_search_idx" },
    { document: LESSON_DOCUMENT, index: "library_lessons_search_idx" },
    { document: COURSE_DOCUMENT, index: "courses_search_idx" },
    { document: SOURCE_DOCUMENT, index: "sources_search_idx" },
    { document: IMAGE_SCENE_DOCUMENT, index: "media_assets_scene_search_idx" },
    { document: EXAM_BLUEPRINT_DOCUMENT, index: "exam_blueprints_search_idx" },
  ])("searches $index instead of reading every row", async ({ document, index }) => {
    await expect(explainTermSearch({ document })).resolves.toContain(index);
  });

  it("filters a term's matches instead of also reading the lessons of a language and level", async () => {
    const plan = await explainTermSearch({
      document: LESSON_DOCUMENT,
      filters: sql`l.language = 'en' AND l.level = 'advanced'`,
    });

    expect(plan).toContain("library_lessons_search_idx");
    expect(plan).not.toContain("library_lessons_language_level_normalized_title_idx");
  });
});
