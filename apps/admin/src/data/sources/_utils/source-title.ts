import { type LibraryVisibility } from "@zoonk/db";

/**
 * A private upload's title is usually its file name, which can name the
 * learner. Admin reads drop it before it reaches any page, so a table or link
 * can never show it by accident. `null` means "private upload".
 */
export function redactSourceTitle<Source extends { title: string; visibility: LibraryVisibility }>(
  source: Source,
): Omit<Source, "title"> & { title: string | null } {
  return { ...source, title: source.visibility === "private" ? null : source.title };
}
