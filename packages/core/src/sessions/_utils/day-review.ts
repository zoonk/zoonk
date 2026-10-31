import { getItemKey } from "../../plans/planner/plan-items";
import { type SessionPlanItem } from "./session-plan-item";

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
