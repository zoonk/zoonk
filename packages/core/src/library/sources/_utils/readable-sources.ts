import { sql } from "@zoonk/db";
import { PDF_CONTENT_TYPE } from "../source-contract";

const MIN_READABLE_TEXT_LENGTH = 200;

export const READABLE_SOURCE_FILTER = sql`(s.mime_type = ${PDF_CONTENT_TYPE}
  OR char_length(s.extracted_text) >= ${MIN_READABLE_TEXT_LENGTH})`;
