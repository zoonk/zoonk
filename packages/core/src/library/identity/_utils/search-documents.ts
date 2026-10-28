import "server-only";
import { sql } from "@zoonk/db";
import { type IndexedDocument } from "./text-search-sql";

/** These expressions must match the text-search indexes in migrations exactly for PostgreSQL to use them. */
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

export const SOURCE_DOCUMENT = {
  alias: sql`s`,
  language: sql`s.language`,
  parts: sql`ARRAY[s.title, s.publisher, s.url]`,
  table: sql`sources`,
} satisfies IndexedDocument;

export const IMAGE_SCENE_DOCUMENT = {
  alias: sql`m`,
  indexed: sql`m.kind = 'image' AND m.visibility = 'public' AND m.prompt IS NOT NULL`,
  language: sql`'en'`,
  parts: sql`ARRAY[m.prompt]`,
  table: sql`media_assets`,
} satisfies IndexedDocument;

export const EXAM_BLUEPRINT_DOCUMENT = {
  alias: sql`e`,
  indexed: sql`e.visibility = 'public'`,
  language: sql`e.language`,
  parts: sql`ARRAY[e.name, e.board, e.role, replace(e.identity_key, '-', ' ')]`,
  table: sql`exam_blueprints`,
} satisfies IndexedDocument;
