import { type PlanItemReason } from "@zoonk/ai/tasks/lessons/question-context";
import { type StudySessionBlock } from "@zoonk/db";
import { type BlockPayload, readBlockPayload } from "../../sessions/block-payload";

function getPracticeReason(payload: BlockPayload): PlanItemReason {
  if (payload.fullReview) {
    return "fullReview";
  }

  return payload.drills.length > 0 ? "mistakes" : "weakArea";
}

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
