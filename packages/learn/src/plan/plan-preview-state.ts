import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { getPlanAdviceRevision } from "./plan-advice-revision";

type PreviewPlan = Parameters<typeof getPlanAdviceRevision>[0]["plan"] & Pick<PlanView, "week">;
export type PreviewScope = "advice" | "plan";

type PreviewInput = { operations: LearnerPlanOperation[]; plan: PreviewPlan; scope?: PreviewScope };

function adviceRevision(plan: PreviewPlan): string {
  const today = plan.week.days.find((day) => day.state === "today")?.date ?? plan.week.startDate;
  return getPlanAdviceRevision({ plan, today });
}

export type PlanPreviewState =
  | { status: "idle" }
  | (PreviewInput & { status: "failed" | "loading" })
  | (PreviewInput & { preview: PlanChangePreview; status: "ready" });

/**
 * Date and coverage previews follow advice inputs; fit checks and other edits keep the whole plan
 * as their base. An unchanged refresh keeps either kind.
 */
export function isSamePreviewPlan({
  current,
  previous,
  scope = "plan",
}: {
  current: PreviewPlan;
  previous: PreviewPlan;
  scope?: PreviewScope;
}): boolean {
  if (current === previous) {
    return true;
  }

  return scope === "advice"
    ? adviceRevision(current) === adviceRevision(previous)
    : JSON.stringify(current) === JSON.stringify(previous);
}

export function currentPlanPreview({
  operations,
  plan,
  state,
}: PreviewInput & { state: PlanPreviewState }): PlanPreviewState {
  if (
    state.status === "idle" ||
    !isSamePreviewPlan({ current: plan, previous: state.plan, scope: state.scope }) ||
    JSON.stringify(state.operations) !== JSON.stringify(operations)
  ) {
    return { status: "idle" };
  }

  return state;
}

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
