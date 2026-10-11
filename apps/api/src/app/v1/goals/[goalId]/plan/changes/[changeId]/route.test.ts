import { scheduleGoalPreparation } from "@/lib/session-preparation";
import { decidePlanChange } from "@zoonk/core/plans/decide-change";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH as decideChange } from "./route";

// Core's integration tests cover what each decision does to the plan; this adapter test covers
// which decisions start writing what the plan has soon (the preparation itself is a workflow).
vi.mock("@zoonk/core/plans/decide-change", () => ({ decidePlanChange: vi.fn() }));
vi.mock("@/lib/session-preparation", () => ({ scheduleGoalPreparation: vi.fn() }));

const GOAL_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190b";
const CHANGE_ID = "019c9bd7-bf11-73cb-9cc8-fe371298190c";

function decide(status: string) {
  const request = new NextRequest(
    `http://localhost/v1/goals/${GOAL_ID}/plan/changes/${CHANGE_ID}`,
    { body: JSON.stringify({ status, timeZone: "UTC" }), method: "PATCH" },
  );

  return decideChange(request, {
    params: Promise.resolve({ changeId: CHANGE_ID, goalId: GOAL_ID }),
  });
}

describe("PATCH /v1/goals/{goalId}/plan/changes/{changeId}", () => {
  beforeEach(() => {
    vi.mocked(decidePlanChange).mockResolvedValue({
      change: { id: CHANGE_ID } as PlanChangeView,
      status: "updated",
    });
  });

  it.each(["applied", "undone"])(
    "starts writing what the plan has soon once a change is %s",
    async (status) => {
      const response = await decide(status);

      expect(response.status).toBe(200);
      expect(scheduleGoalPreparation).toHaveBeenCalledExactlyOnceWith(GOAL_ID);
    },
  );

  it.each(["declined", "seen"])("starts nothing when a change is %s", async (status) => {
    const response = await decide(status);

    expect(response.status).toBe(200);
    expect(scheduleGoalPreparation).not.toHaveBeenCalled();
  });

  it("starts nothing when the decision isn't saved", async () => {
    vi.mocked(decidePlanChange).mockResolvedValue({ status: "conflict" });

    const response = await decide("applied");

    expect(response.status).toBe(409);
    expect(scheduleGoalPreparation).not.toHaveBeenCalled();
  });
});
