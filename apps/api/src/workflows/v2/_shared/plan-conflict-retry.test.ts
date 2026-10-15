import { PlanConflictError } from "@zoonk/core/plans/conflict";
import { describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { catchPlanConflict } from "./plan-conflict-outcome";
import { type PlanStepOutcome, retryPlanConflicts } from "./plan-conflict-retry";

/** A step that loses to other writes of the plan `conflicts` times, then saves `value`. */
function stepSavingAfter<T>(conflicts: number, value: T) {
  const runs = { count: 0 };

  return vi.fn(async (_input: string): Promise<PlanStepOutcome<T>> => {
    runs.count += 1;
    return runs.count > conflicts ? { conflict: false, value } : { conflict: true };
  });
}

describe(retryPlanConflicts, () => {
  it("returns what the step saved, without waiting, when nothing else wrote the plan", async () => {
    const step = stepSavingAfter(0, "planned");

    await expect(retryPlanConflicts(step, "goal")).resolves.toBe("planned");
    expect(step).toHaveBeenCalledExactlyOnceWith("goal");
    expect(sleep).not.toHaveBeenCalled();
  });

  // Other runs saving the plan's lessons and questions come in bursts: each wait is longer.
  it("runs the step again after a longer durable wait each time the plan kept changing", async () => {
    const step = stepSavingAfter(2, "planned");

    await expect(retryPlanConflicts(step, "goal")).resolves.toBe("planned");
    expect(step).toHaveBeenCalledTimes(3);
    expect(vi.mocked(sleep).mock.calls).toStrictEqual([["5s"], ["15s"]]);
  });

  it("gives up after six attempts, five waits, for the run's own failure handling", async () => {
    const step = stepSavingAfter(Infinity, "planned");

    await expect(retryPlanConflicts(step, "goal")).rejects.toThrow("kept changing");
    expect(step).toHaveBeenCalledTimes(6);

    expect(vi.mocked(sleep).mock.calls).toStrictEqual([["5s"], ["15s"], ["45s"], ["2m"], ["2m"]]);
  });
});

describe(catchPlanConflict, () => {
  it("says the plan kept changing, passes results through, and throws every other error", async () => {
    const failure = new Error("The database went away");

    await expect(
      catchPlanConflict(() => Promise.reject(new PlanConflictError())),
    ).resolves.toStrictEqual({ conflict: true });

    await expect(catchPlanConflict(() => Promise.resolve("planned"))).resolves.toStrictEqual({
      conflict: false,
      value: "planned",
    });

    await expect(catchPlanConflict(() => Promise.reject(failure))).rejects.toBe(failure);
  });
});
