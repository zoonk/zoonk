import { readBlockPayload } from "../block-payload";
import { type DayBlockInput } from "./day-block-view";

type NumberedBlock = Pick<DayBlockInput, "kind" | "payload" | "position">;

/** Mistakes, a full review and a subject's practice have names of their own. */
function isPlainPractice(block: NumberedBlock): boolean {
  const payload = readBlockPayload(block);

  return (
    block.kind === "practice" && payload.itemIds.length > 0 && !payload.fullReview && !payload.title
  );
}

/**
 * A practice mixes several topics, so no topic can name it: a day with more than one numbers them
 * by where they were planned, so opening, finishing or skipping one never renames another. Null
 * when it's the day's only one.
 */
export function getPracticeNumber({
  block,
  blocks,
}: {
  block: NumberedBlock;
  blocks: readonly NumberedBlock[];
}): number | null {
  if (!isPlainPractice(block)) {
    return null;
  }

  const positions = blocks
    .filter((candidate) => isPlainPractice(candidate))
    .map((candidate) => candidate.position)
    .toSorted((a, b) => a - b);

  return positions.length < 2 ? null : positions.indexOf(block.position) + 1 || null;
}
