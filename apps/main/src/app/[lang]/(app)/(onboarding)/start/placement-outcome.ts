import { type getGoalPlacement } from "@zoonk/core/learner/placement/get";
import { type PlacementOutcome, type PlacementQuestion } from "@zoonk/learn/onboarding/actions";

type PlacementState = Extract<
  Awaited<ReturnType<typeof getGoalPlacement>>,
  { status: "ready" }
>["placement"];

const NOT_READY = new Set<PlacementState["status"]>(["preparing", "waitingForQuestions"]);

function toPlacementQuestion(next: NonNullable<PlacementState["next"]>): PlacementQuestion {
  return {
    context: next.context,
    format: next.format,
    image: next.image,
    itemId: next.itemId,
    left: "left" in next ? next.left : null,
    options: next.options,
    question: next.question,
    right: "right" in next ? next.right : null,
    select: "select" in next ? (next.select ?? null) : null,
    skillId: next.skillId,
    visual: next.visual,
  };
}

/** Whether an answer was right stays on the server: no placement screen shows it. */
export function toPlacementOutcome(placement: PlacementState): PlacementOutcome {
  if (NOT_READY.has(placement.status)) {
    return {
      attempt: placement.attempt ?? null,
      focusTest: placement.focusTest,
      status: "notReady",
    };
  }

  if (placement.status === "failed") {
    return { attempt: placement.attempt ?? null, status: "generationFailed" };
  }

  if (placement.status === "unavailable") {
    return { attempt: placement.attempt ?? null, status: "unavailable" };
  }

  return {
    attempt: placement.attempt ?? null,
    focusTest: placement.focusTest,
    next: placement.next && toPlacementQuestion(placement.next),
    result: placement.result ?? null,
    status: "ready",
    trueFalseLabels: placement.trueFalseLabels,
  };
}
