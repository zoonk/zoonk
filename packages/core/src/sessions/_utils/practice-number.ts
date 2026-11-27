import { readBlockPayload } from "../block-payload";
import { type DayBlockInput } from "./day-block-view";
import { inDayOrder } from "./day-order";

type NumberedBlock = Pick<DayBlockInput, "kind" | "payload" | "position" | "status">;

/** Mistakes, a full review and a subject's practice have names of their own. */
function isPlainPractice(block: NumberedBlock): boolean {
  const payload = readBlockPayload(block);

  return (
    block.kind === "practice" &&
    block.status !== "skipped" &&
    payload.itemIds.length > 0 &&
    !payload.fullReview &&
    !payload.title
  );
}

/**
 * A practice mixes several topics, so no topic can name it: a day with more than one is numbered in
 * the order it lists them, so each row has a name of its own. Null when it's the day's only one.
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

  const practices = inDayOrder(blocks).filter((candidate) => isPlainPractice(candidate));

  if (practices.length < 2) {
    return null;
  }

  const index = practices.findIndex((candidate) => candidate.position === block.position);
  return index === -1 ? null : index + 1;
}
