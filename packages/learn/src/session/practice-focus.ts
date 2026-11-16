import { type StudyBlock } from "./session-types";

type PracticeFocus = { kind: "areas"; names: string[] } | { kind: "topic"; name: string };

/**
 * What a practice row is named after: the topic most of its questions are on, so two practices on
 * one subject in a day never share a name; its subjects when it has no topics. Null for a practice
 * of mistakes or of every topic, which have names of their own.
 */
export function getPracticeFocus(
  block: Pick<StudyBlock, "areas" | "fullReview" | "kind" | "mistakesOnly" | "topics">,
): PracticeFocus | null {
  if (block.kind !== "practice" || block.fullReview || block.mistakesOnly) {
    return null;
  }

  const [topic] = block.topics;

  if (topic) {
    return { kind: "topic", name: topic };
  }

  return block.areas.length > 0 ? { kind: "areas", names: block.areas } : null;
}
