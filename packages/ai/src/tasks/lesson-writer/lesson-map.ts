import { toPlainLine } from "@zoonk/utils/text-repairs";
import { type LessonMap, type WrittenLessonMap } from "./written-lesson-schema";

const NESTED_LEVELS = { max: 5, min: 2 } as const;

function cleanLabel(label: string): string {
  return toPlainLine(label).replace(/[.:;,]+$/u, "");
}

function sameText(text: string): string {
  return text.normalize("NFC").replaceAll(/\s+/gu, " ").trim();
}

/** Accents and case stay: "Avó" and "Avô" are two ideas. */
export function getLessonMapIdeaKey(idea: { label?: string; text: string }): string {
  return `${sameText(idea.label ?? "")}\n${sameText(idea.text)}`;
}

/** A nested map draws each level inside the last, so it needs 2 to 5 named levels; else a hub. */
export function getLessonMapShape({
  ideas,
  shape,
}: {
  ideas: LessonMap["ideas"];
  shape: LessonMap["shape"];
}): LessonMap["shape"] {
  const drawsNested =
    ideas.length >= NESTED_LEVELS.min &&
    ideas.length <= NESTED_LEVELS.max &&
    ideas.every((idea) => idea.label);

  return shape === "nested" && drawsNested ? "nested" : "hub";
}

/** Never drops a real idea: only empty ones and exact repeats of another idea's label and sentence. */
export function normalizeLessonMap(map: WrittenLessonMap): LessonMap {
  const seen = new Set<string>();

  const ideas = map.ideas.flatMap((idea) => {
    const text = idea.text.trim();
    const label = cleanLabel(idea.label);
    const cleaned = label ? { label, text } : { text };
    const key = getLessonMapIdeaKey(cleaned);

    if (!text || seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [cleaned];
  });

  return { ideas, shape: getLessonMapShape({ ideas, shape: map.shape }) };
}
