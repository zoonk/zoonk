import { getItemKey } from "../../plans/planner/plan-items";
import { type SessionPlanItem } from "./session-plan-item";

/** A due selected review is present before Open assigns its persisted row ID. */
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
