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
 * What a session block is, as a `KindTile` draws it: a lesson, a review, practice, writing, the
 * week's challenge or a mock exam, so a block has the same color and icon wherever it shows.
 */
export function getBlockKind(block: Pick<StudyBlock, "checkpoint" | "kind">): LearnKind {
  if (block.checkpoint?.mock) {
    return "mock";
  }

  return block.checkpoint ? "challenge" : KIND_BY_BLOCK[block.kind];
}
