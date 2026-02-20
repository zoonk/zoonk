import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { lessonPreloadWorkflow } from "./lesson-preload-workflow";

vi.mock("workflow", () => ({
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
}));

vi.mock("@/workflows/lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: vi.fn().mockImplementation(async () => {}),
}));

vi.mock("@/workflows/activity-generation/activity-generation-workflow", () => ({
  activityGenerationWorkflow: vi.fn().mockImplementation(async () => {}),
}));

describe(lessonPreloadWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls lessonGenerationWorkflow then activityGenerationWorkflow in sequence", async () => {
    const callOrder: string[] = [];

    vi.mocked(lessonGenerationWorkflow).mockImplementation(async () => {
      callOrder.push("lessonGeneration");
    });

    vi.mocked(activityGenerationWorkflow).mockImplementation(async () => {
      callOrder.push("activityGeneration");
    });

    await lessonPreloadWorkflow(42);

    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(42);
    expect(activityGenerationWorkflow).toHaveBeenCalledWith(42);
    expect(callOrder).toEqual(["lessonGeneration", "activityGeneration"]);
  });

  test("propagates errors from lessonGenerationWorkflow", async () => {
    vi.mocked(lessonGenerationWorkflow).mockRejectedValueOnce(new Error("lesson gen failed"));

    await expect(lessonPreloadWorkflow(1)).rejects.toThrow("lesson gen failed");
    expect(activityGenerationWorkflow).not.toHaveBeenCalled();
  });

  test("propagates errors from activityGenerationWorkflow", async () => {
    vi.mocked(activityGenerationWorkflow).mockRejectedValueOnce(new Error("activity gen failed"));

    await expect(lessonPreloadWorkflow(1)).rejects.toThrow("activity gen failed");
    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(1);
  });
});
