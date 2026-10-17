import { type PlanItemReason } from "@zoonk/ai/tasks/lessons/question-context";
import { type StudySessionBlock } from "@zoonk/db";
import { type BlockPayload, readBlockPayload } from "../../sessions/block-payload";

/** A practice block's reason: a full review, fixing mistakes, or the weakest skills. */
function getPracticeReason(payload: BlockPayload): PlanItemReason {
  if (payload.fullReview) {
    return "fullReview";
  }

  return payload.drills.length > 0 ? "mistakes" : "weakArea";
}

/**
 * Why a block is in today's session, as the session builder put it there: daily practice rotates
 * through the weakest skills, drills are on saved mistakes, and a full review takes a mock's day
 * the learner's plan doesn't include.
 */
export function getBlockReason(
  block: Pick<StudySessionBlock, "id" | "kind" | "payload">,
): PlanItemReason {
  const payload = readBlockPayload(block);

  if (payload.extra) {
    return "extraPractice";
  }

  switch (block.kind) {
    case "checkpoint":
      return "checkpoint";
    case "learn":
      return payload.reinforcement ? "reinforcement" : "newSkill";
    case "practice":
      return getPracticeReason(payload);
    case "produce":
      return "produce";
    case "review":
      return "reviewDue";
    default:
      return block.kind satisfies never;
  }
}
