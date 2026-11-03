import { normalizeString } from "@zoonk/utils/string";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { type LessonMap, type WrittenLessonMap } from "./written-lesson-schema";

const MIN_NESTED_LEVELS = 2;

function cleanLabel(label: string): string {
  return toPlainLine(label).replace(/[.:;,]+$/u, "");
}

function ideaKey(idea: { label?: string; text: string }): string {
  return `${normalizeString(idea.label ?? "")}\n${normalizeString(idea.text)}`;
}

function drawsNested(ideas: LessonMap["ideas"]): boolean {
  return ideas.length >= MIN_NESTED_LEVELS && ideas.every((idea) => idea.label);
}

/**
 * Never drops a real idea: only empty ones and exact repeats of another idea's label and sentence.
 * A nested map whose levels aren't all named is drawn as a hub.
 */
export function normalizeLessonMap(map: WrittenLessonMap): LessonMap {
  const seen = new Set<string>();

  const ideas = map.ideas.flatMap((idea) => {
    const text = idea.text.trim();
    const label = cleanLabel(idea.label);
    const cleaned = label ? { label, text } : { text };
    const key = ideaKey(cleaned);

    if (!text || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [cleaned];
  });

  const shape = map.shape === "nested" && drawsNested(ideas) ? "nested" : "hub";

  return { ideas, shape };
}
