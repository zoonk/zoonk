import { type LearnKind } from "../_components/kind-tile";
import { type StudyBlock } from "./session-types";

const KIND_BY_BLOCK: Readonly<Record<StudyBlock["kind"], LearnKind>> = {
  checkpoint: "challenge",
  learn: "lesson",
  practice: "practice",
  produce: "essay",
  review: "review",
};

/**
 * Practice that only fixes mistakes is the notebook's kind, as the "Fix a mistake" mission it
 * counts for is.
 */
export function getBlockKind(
  block: Pick<StudyBlock, "checkpoint" | "kind" | "mistakesOnly">,
): LearnKind {
  if (block.checkpoint?.mock) {
    return "mock";
  }

  if (block.checkpoint) {
    return "challenge";
  }

  return block.mistakesOnly ? "mistakes" : KIND_BY_BLOCK[block.kind];
}
