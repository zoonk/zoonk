import { type LearnerPlanOperation } from "@zoonk/core/plans/contract";
import { type PlanChangePreview } from "@zoonk/core/plans/preview-contract";
import { describe, expect, it } from "vitest";
import { currentPlanPreview, resolvePlanPreview } from "./plan-preview-state";

const operations: LearnerPlanOperation[] = [{ kind: "setDailyMinutes", minutes: 60 }];
const plan = { id: "plan", revision: 1 };
const request = { operations, plan, status: "loading" } as const;

const unchanged: PlanChangePreview = {
  effect: null,
  feasibility: null,
  ready: true,
  unchanged: true,
};

describe("plan preview validity", () => {
  it("keeps a valid unchanged result distinct from failure", () => {
    expect(resolvePlanPreview({ current: request, preview: unchanged, request }).status).toBe(
      "ready",
    );

    expect(resolvePlanPreview({ current: request, preview: null, request }).status).toBe("failed");

    expect(
      resolvePlanPreview({ current: request, preview: { ...unchanged, ready: false }, request })
        .status,
    ).toBe("failed");

    expect(
      resolvePlanPreview({ current: request, preview: { ...unchanged, unchanged: false }, request })
        .status,
    ).toBe("failed");
  });

  it("requires both the previewed operations and the same server plan revision", () => {
    const state = resolvePlanPreview({ current: request, preview: unchanged, request });
    expect(currentPlanPreview({ operations: [...operations], plan, state })).toBe(state);

    expect(currentPlanPreview({ operations, plan: { ...plan }, state })).toBe(state);

    expect(
      currentPlanPreview({ operations: [{ kind: "setDailyMinutes", minutes: 90 }], plan, state })
        .status,
    ).toBe("idle");

    expect(currentPlanPreview({ operations, plan: { ...plan, revision: 2 }, state }).status).toBe(
      "idle",
    );
  });

  it("drops a late response after cancellation or another preview request", () => {
    const idle = { status: "idle" } as const;
    const newer = { ...request };
    expect(resolvePlanPreview({ current: idle, preview: unchanged, request })).toBe(idle);
    expect(resolvePlanPreview({ current: newer, preview: unchanged, request })).toBe(newer);
  });
});
