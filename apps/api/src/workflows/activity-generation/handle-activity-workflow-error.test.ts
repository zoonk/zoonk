import { beforeEach, describe, expect, test, vi } from "vitest";
import { failActivityWorkflow, failActivityWorkflows } from "./handle-activity-workflow-error";
import { handleActivityFailureStep } from "./steps/handle-failure-step";

vi.mock("./steps/handle-failure-step", () => ({
  handleActivityFailureStep: vi.fn(async () => {}),
}));

describe("activity workflow failure handling", () => {
  beforeEach(() => {
    vi.mocked(handleActivityFailureStep).mockReset();
    vi.mocked(handleActivityFailureStep).mockImplementation(async () => {});
  });

  test("rethrows the original workflow error when the failure step rejects", async () => {
    const originalError = new Error("AI generation failed");

    vi.mocked(handleActivityFailureStep).mockRejectedValueOnce(
      new Error("Failed to mark activity failed"),
    );

    await expect(
      failActivityWorkflow({
        activityId: "activity-1",
        error: originalError,
      }),
    ).rejects.toBe(originalError);
  });

  test("attempts every activity failure update before rethrowing the original error", async () => {
    const originalError = new Error("Vocabulary generation failed");

    vi.mocked(handleActivityFailureStep).mockRejectedValueOnce(new Error("First update failed"));

    await expect(
      failActivityWorkflows({
        activityIds: ["vocabulary-activity", "translation-activity"],
        error: originalError,
      }),
    ).rejects.toBe(originalError);

    expect(handleActivityFailureStep).toHaveBeenCalledTimes(2);
  });
});
