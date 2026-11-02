import { normalizeString } from "@zoonk/utils/string";
import { toPlainLine } from "@zoonk/utils/text-repairs";
import { type LessonMap, type LessonMapShape } from "./written-lesson-schema";

const MAX_NODES = 5;
const MAX_LABEL_WORDS = 4;

/** The node counts each shape can be drawn with on a phone. */
const NODE_RANGE: Readonly<Record<LessonMapShape, { min: number; max: number }>> = {
  compare: { max: 3, min: 2 },
  equation: { max: MAX_NODES, min: 3 },
  hub: { max: MAX_NODES, min: 3 },
  list: { max: MAX_NODES, min: 1 },
  nested: { max: MAX_NODES, min: 2 },
  sequence: { max: MAX_NODES, min: 2 },
};

function countWords(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

function cleanLabel(label: string): string {
  return toPlainLine(label).replace(/[.:;,]+$/u, "");
}

function fitsShape({ nodes, shape }: LessonMap): boolean {
  const range = NODE_RANGE[shape];

  return (
    nodes.length >= range.min &&
    nodes.length <= range.max &&
    nodes.every((node) => node.label && countWords(node.label) <= MAX_LABEL_WORDS)
  );
}

/**
 * Drops empty and repeated ideas and keeps the first five; a map whose nodes don't fit its shape is
 * drawn as a list, which fits any of them.
 */
export function normalizeLessonMap(map: LessonMap): LessonMap {
  const seen = new Set<string>();

  const nodes = map.nodes
    .map((node) => ({ idea: node.idea.trim(), label: cleanLabel(node.label) }))
    .filter((node) => {
      const key = normalizeString(node.idea);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, MAX_NODES);

  return { nodes, shape: fitsShape({ nodes, shape: map.shape }) ? map.shape : "list" };
}

export function getLessonMapIdeas(map: LessonMap): string[] {
  return map.nodes.map((node) => node.idea);
}
