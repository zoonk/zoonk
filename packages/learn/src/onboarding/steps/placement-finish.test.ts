import { describe, expect, it, vi } from "vitest";
import { saveFinish } from "./placement-finish";

const input = { fromScratch: false, goalId: "goal", stopMockId: "mock" };

function actionsWith(stop: () => Promise<boolean>) {
  return { finishPlacement: vi.fn(async () => true), stopPlacementMock: vi.fn(stop) };
}

describe(saveFinish, () => {
  it("leaves placement open when stopping the mock fails, so its answers are graded on the next try", async () => {
    const actions = actionsWith(() => Promise.reject(new Error("offline")));

    await expect(saveFinish({ actions, ...input })).rejects.toThrow("offline");

    expect(actions.finishPlacement).not.toHaveBeenCalled();
  });

  it("finishes placement when the mock was already over", async () => {
    const actions = actionsWith(async () => false);

    await expect(saveFinish({ actions, ...input })).resolves.toBe(true);
  });
});
