import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";

const MAX_TOOL_NAME_LENGTH = 80;

const chapterToolSchema = z.object({
  essential: z.boolean(),
  name: z.string().trim().min(1).max(MAX_TOOL_NAME_LENGTH),
});

const chapterToolsSchema = z.array(chapterToolSchema);

type ChapterTool = z.infer<typeof chapterToolSchema>;

export function parseChapterTools(value: unknown): ChapterTool[] {
  const parsed = chapterToolsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function needsTool(tools: unknown): boolean {
  return parseChapterTools(tools).some((tool) => tool.essential);
}

const TOOL_CHOICES = /\s*\([^()]*\)\s*$/u;

export function getToolKey(name: string): string {
  return normalizeString(name.replace(TOOL_CHOICES, "") || name);
}
