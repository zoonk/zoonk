import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";

type PreviewInput = { operations: LearnerPlanOperation[]; plan: object };

export type PlanPreviewState =
  | { status: "idle" }
  | (PreviewInput & { status: "failed" | "loading" })
  | (PreviewInput & { preview: PlanChangePreview; status: "ready" });

/** A refresh can deserialize an unchanged server view again without changing the preview's base. */
export function isSamePreviewPlan({
  current,
  previous,
}: {
  current: object;
  previous: object;
}): boolean {
  return current === previous || JSON.stringify(current) === JSON.stringify(previous);
}

/** A preview belongs to the exact operations and serialized server plan it was computed from. */
export function currentPlanPreview({
  operations,
  plan,
  state,
}: PreviewInput & { state: PlanPreviewState }): PlanPreviewState {
  if (
    state.status === "idle" ||
    !isSamePreviewPlan({ current: plan, previous: state.plan }) ||
    JSON.stringify(state.operations) !== JSON.stringify(operations)
  ) {
    return { status: "idle" };
  }

  return state;
}

/** Only the still-active request can publish a computed effect or a retryable failure. */
export function resolvePlanPreview({
  current,
  preview,
  request,
}: {
  current: PlanPreviewState;
  preview: PlanChangePreview | null;
  request: PreviewInput & { status: "loading" };
}): PlanPreviewState {
  if (current !== request) {
    return current;
  }

  if (!preview?.ready || (!preview.unchanged && preview.effect === null)) {
    return { ...request, status: "failed" };
  }

  return { ...request, preview, status: "ready" };
}
