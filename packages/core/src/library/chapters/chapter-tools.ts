import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";

const MAX_TOOL_NAME_LENGTH = 80;

/**
 * A tool a chapter's lessons have the learner use on their own device, as `Chapter.tools` stores
 * it: a generic name such as "Spreadsheet (Google Sheets or Excel)", and whether practicing the
 * chapter needs it (`essential`) or it only helps.
 */
const chapterToolSchema = z.object({
  essential: z.boolean(),
  name: z.string().trim().min(1).max(MAX_TOOL_NAME_LENGTH),
});

const chapterToolsSchema = z.array(chapterToolSchema);

type ChapterTool = z.infer<typeof chapterToolSchema>;

/** Reads a chapter's stored tools; anything unreadable counts as none. */
export function parseChapterTools(value: unknown): ChapterTool[] {
  const parsed = chapterToolsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** The usual choices a name lists after the tool: "Python (NumPy and SciPy)" is Python. */
const TOOL_CHOICES = /\s*\([^()]*\)\s*$/u;

/**
 * The same tool named with different case, accents, spacing or listed choices is one tool:
 * "Python", "python" and "Python (NumPy and SciPy)" share a key.
 */
export function getToolKey(name: string): string {
  return normalizeString(name.replace(TOOL_CHOICES, "") || name);
}
