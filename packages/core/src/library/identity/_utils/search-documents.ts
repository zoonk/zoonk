import "server-only";
import { sql } from "@zoonk/db";
import { type IndexedDocument } from "./text-search-sql";

/**
 * The searchable document of each table with a text-search index, written exactly like its index
 * in migrations `library_text_search_index`, `library_text_search_more_indexes` and
 * `exam_blueprints_text_search_index`: any other expression can't use the index. Each one names
 * its table and the alias its expressions use.
 */

export const SKILL_DOCUMENT = {
  alias: sql`s`,
  language: sql`s.language`,
  parts: sql`ARRAY[s.name, s.normalized_name, s.description]`,
  table: sql`skills`,
} satisfies IndexedDocument;

export const CHAPTER_DOCUMENT = {
  alias: sql`c`,
  language: sql`c.language`,
  parts: sql`ARRAY[c.title, c.normalized_title, c.description] || c.objectives`,
  table: sql`library_chapters`,
} satisfies IndexedDocument;

/** A lesson's own words; its search document adds the names of the skills it teaches. */
export const LESSON_DOCUMENT = {
  alias: sql`l`,
  language: sql`l.language`,
  parts: sql`ARRAY[l.title, l.normalized_title, l.description, l.can_do]`,
  table: sql`library_lessons`,
} satisfies IndexedDocument;

export const COURSE_DOCUMENT = {
  alias: sql`c`,
  language: sql`c.language`,
  parts: sql`ARRAY[c.title, c.normalized_title, c.description]`,
  table: sql`courses`,
} satisfies IndexedDocument;

/** A shared source's title, publisher and address, to find mirrors and re-uploads. */
export const SOURCE_DOCUMENT = {
  alias: sql`s`,
  language: sql`s.language`,
  parts: sql`ARRAY[s.title, s.publisher, s.url]`,
  table: sql`sources`,
} satisfies IndexedDocument;

/**
 * An image's scene. Scenes are always written in English, so the language is part of the
 * expression; the index covers public images that have a scene.
 */
export const IMAGE_SCENE_DOCUMENT = {
  alias: sql`m`,
  indexed: sql`m.kind = 'image' AND m.visibility = 'public' AND m.prompt IS NOT NULL`,
  language: sql`'en'`,
  parts: sql`ARRAY[m.prompt]`,
  table: sql`media_assets`,
} satisfies IndexedDocument;

/**
 * A shared exam's name, board, role and the words of its key, such as `enem`. The index covers
 * public blueprints; a private one is only ever found by its key.
 */
export const EXAM_BLUEPRINT_DOCUMENT = {
  alias: sql`e`,
  indexed: sql`e.visibility = 'public'`,
  language: sql`e.language`,
  parts: sql`ARRAY[e.name, e.board, e.role, replace(e.identity_key, '-', ' ')]`,
  table: sql`exam_blueprints`,
} satisfies IndexedDocument;
