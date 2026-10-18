import { type StudyBlockKind, type StudyBlockStatus } from "@zoonk/db";
import { type Mission } from "./missions";

/** What a block of the day says about itself, as the session's view has it. */
type MissionBlockFields = {
  extra: boolean;
  id: string;
  kind: StudyBlockKind;
  reinforcement: boolean;
  status: StudyBlockStatus;
};

/**
 * The mission a block of the day counts for, as the day's missions count them: a planned review
 * for "review" and a planned new lesson for "somethingNew". Extra blocks and reinforcement lessons
 * count for none. Mistakes are fixed in the notebook, so no block is "fixMistake"'s.
 */
export function getBlockMission(
  block: Pick<MissionBlockFields, "extra" | "kind" | "reinforcement">,
): Mission["kind"] | null {
  if (block.extra) {
    return null;
  }

  if (block.kind === "review") {
    return "review";
  }

  return block.kind === "learn" && !block.reinforcement ? "somethingNew" : null;
}

/**
 * The block a session built before missions were stored opens for a mission (its `opens`): the
 * day's first block that counts for it and is still to do (not started yet, or under way). Null
 * once none is left, and for "fixMistake", which the mistakes notebook's practice does.
 */
export function findMissionBlock<Block extends MissionBlockFields>({
  blocks,
  kind,
}: {
  blocks: readonly Block[];
  kind: Mission["kind"];
}): Block | null {
  return (
    blocks.find(
      (block) =>
        getBlockMission(block) === kind &&
        (block.status === "pending" || block.status === "active"),
    ) ?? null
  );
}
