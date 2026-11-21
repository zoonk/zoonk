import { type StudySessionBlock } from "@zoonk/db";
import { isPlusOnlyMockDay } from "../../checkpoints/_utils/load-weekly-challenge";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../block-payload";
import { type SessionPlanItem } from "./session-plan-item";

type SavedReviewInput = {
  blocks: readonly Pick<StudySessionBlock, "payload">[];
  includesMockExams: boolean;
  items: readonly SessionPlanItem[];
  today: Date;
};

export function isSavedReviewDay(input: SavedReviewInput): boolean {
  return Boolean(findPlannedReview(input)) || isSavedFullReviewDay(input);
}

export function isSavedFullReviewDay({
  blocks,
  includesMockExams,
  items,
  today,
}: SavedReviewInput): boolean {
  return (
    isPlusOnlyMockDay({ includesMockExams, items, today }) ||
    blocks.some((block) => readBlockPayload(block).fullReview)
  );
}

/** A spare review can share its day with the optional study the planner allocated there. */
export function listReviewExtraItems({
  graph,
  items,
  today,
}: {
  graph: PlanGraph;
  items: readonly SessionPlanItem[];
  today: Date;
}): SessionPlanItem[] {
  const extras = new Set(graph.skills.flatMap((skill) => (skill.extra ? [skill.skillId] : [])));

  return items.filter(
    (item) =>
      item.status === "todo" &&
      LEARN_KINDS.has(item.kind) &&
      item.scheduledFor?.getTime() === today.getTime() &&
      extras.has(item.skillId ?? ""),
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
