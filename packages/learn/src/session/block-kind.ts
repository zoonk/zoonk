import { type LearnKind } from "../_components/kind-tile";
import { type StudyBlock } from "./session-types";

const KIND_BY_BLOCK: Readonly<Record<StudyBlock["kind"], LearnKind>> = {
  checkpoint: "challenge",
  learn: "lesson",
  practice: "practice",
  produce: "essay",
  review: "review",
};

/** Practice that only works on the learner's mistakes is the notebook's kind. */
export function getBlockKind(
  block: Pick<StudyBlock, "checkpoint" | "kind" | "mistakesOnly" | "patternId" | "screen">,
): LearnKind {
  if (block.checkpoint?.mock) {
    return "mock";
  }

  if (block.checkpoint) {
    return "challenge";
  }

  const onMistakes =
    block.mistakesOnly || block.screen === "mistakesPractice" || Boolean(block.patternId);

  return onMistakes ? "mistakes" : KIND_BY_BLOCK[block.kind];
}

/**
 * A day's mistakes row still to open whose questions were all fixed elsewhere since the day began.
 * A finished row keeps what it recorded.
 */
export function isAlreadyFixed(
  block: Pick<StudyBlock, "questions" | "screen" | "status">,
): boolean {
  return (
    block.screen === "mistakesPractice" &&
    block.questions === 0 &&
    block.status !== "completed" &&
    block.status !== "skipped"
  );
}
