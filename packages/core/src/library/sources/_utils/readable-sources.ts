import { sql } from "@zoonk/db";
import { PDF_CONTENT_TYPE } from "../source-contract";

/**
 * Below this, a fetched page holds no document. Pages that build their text with JavaScript store
 * nothing (mecnormas.mec.gov.br's notice pages) or a line asking to turn JavaScript on
 * (cebraspe.org.br's exam pages, 70 characters), while the shortest official document research
 * read is a 1,900-character calendar.
 */
const MIN_READABLE_TEXT_LENGTH = 200;

/**
 * Sources (as `s`) a model can read an exam, a law or a syllabus from: a PDF goes to the model as
 * the file itself, anything else only as its stored text.
 */
export const READABLE_SOURCE_FILTER = sql`(s.mime_type = ${PDF_CONTENT_TYPE}
  OR char_length(s.extracted_text) >= ${MIN_READABLE_TEXT_LENGTH})`;
