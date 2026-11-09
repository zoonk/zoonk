import { type StudySessionBlock } from "@zoonk/db";
import { isPlusOnlyMockDay } from "../../checkpoints/_utils/load-weekly-challenge";
import { readBlockPayload } from "../block-payload";
import { type SessionPlanItem } from "./session-plan-item";

export function isSavedReviewDay({
  blocks,
  includesMockExams,
  items,
  today,
}: {
  blocks: readonly Pick<StudySessionBlock, "payload">[];
  includesMockExams: boolean;
  items: readonly SessionPlanItem[];
  today: Date;
}): boolean {
  return (
    Boolean(findPlannedReview({ items, today })) ||
    isPlusOnlyMockDay({ includesMockExams, items, today }) ||
    blocks.some((block) => readBlockPayload(block).fullReview)
  );
}

/** Planned reviews can be due before Open assigns a persisted id. */
export function findPlannedReview<
  Item extends Pick<SessionPlanItem, "kind" | "scheduledFor" | "status">,
>({ items, today }: { items: readonly Item[]; today: Date }) {
  return (
    items.find(
      (item) =>
        item.kind === "review" &&
        item.status === "todo" &&
        item.scheduledFor !== null &&
        item.scheduledFor <= today,
    ) ?? null
  );
}
