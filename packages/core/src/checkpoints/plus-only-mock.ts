import { type PlanItem } from "@zoonk/db";

/** A mock the learner can't take stands for its own day only, as a full review, so it is over once that day passes. */
export function isPastPlusOnlyMock({
  includesMockExams,
  item,
  today,
}: {
  includesMockExams: boolean;
  item: Pick<PlanItem, "kind" | "scheduledFor">;
  today: Date;
}): boolean {
  return (
    !includesMockExams &&
    item.kind === "mock" &&
    item.scheduledFor !== null &&
    item.scheduledFor < today
  );
}
