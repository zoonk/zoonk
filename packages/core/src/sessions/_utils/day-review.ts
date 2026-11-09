import { type StudySessionBlock } from "@zoonk/db";
import { getItemKey } from "../../plans/planner/plan-items";
import { readBlockPayload } from "../block-payload";
import { type SessionPlanItem } from "./session-plan-item";

export function isSavedReviewDay({
  blocks,
  items,
  today,
}: {
  blocks: readonly Pick<StudySessionBlock, "payload">[];
  items: readonly SessionPlanItem[];
  today: Date;
}): boolean {
  return (
    Boolean(findPlannedReview({ items, today })) ||
    blocks.some((block) => readBlockPayload(block).fullReview)
  );
}

/** Planned reviews can be due before Open assigns a persisted id. */
export function findPlannedReview({
  items,
  today,
}: {
  items: readonly SessionPlanItem[];
  today: Date;
}) {
  const review = items.find(
    (item) =>
      item.kind === "review" &&
      item.status === "todo" &&
      item.scheduledFor !== null &&
      item.scheduledFor <= today,
  );

  return review ? { id: review.id, key: review.key ?? getItemKey(review) } : null;
}
