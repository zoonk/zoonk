import { beforeEach, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "../activity-generation/activity-generation-workflow";
import { lessonGenerationWorkflow } from "../lesson-generation/lesson-generation-workflow";
import { lessonPreloadWorkflow } from "./lesson-preload-workflow";

vi.mock("../lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: vi.fn().mockResolvedValue("ready"),
}));

vi.mock("../activity-generation/activity-generation-workflow", () => ({
  activityGenerationWorkflow: vi.fn().mockImplementation(async () => {}),
}));

describe(lessonPreloadWorkflow, () => {
  const lessonId = "42";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls lessonGenerationWorkflow then activityGenerationWorkflow in sequence", async () => {
    const callOrder: string[] = [];

    vi.mocked(lessonGenerationWorkflow).mockImplementation(async () => {
      callOrder.push("lessonGeneration");
      return "ready";
    });

    vi.mocked(activityGenerationWorkflow).mockImplementation(async () => {
      callOrder.push("activityGeneration");
    });

    await lessonPreloadWorkflow(lessonId);

    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(lessonId);
    expect(activityGenerationWorkflow).toHaveBeenCalledWith(lessonId);
    expect(callOrder).toEqual(["lessonGeneration", "activityGeneration"]);
  });

  test("skips activity generation when lesson generation filters the lesson", async () => {
    vi.mocked(lessonGenerationWorkflow).mockResolvedValueOnce("filtered");

    await lessonPreloadWorkflow(lessonId);

    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(lessonId);
    expect(activityGenerationWorkflow).not.toHaveBeenCalled();
  });

  test("propagates errors from lessonGenerationWorkflow", async () => {
    vi.mocked(lessonGenerationWorkflow).mockRejectedValueOnce(new Error("lesson gen failed"));

    await expect(lessonPreloadWorkflow(lessonId)).rejects.toThrow("lesson gen failed");
    expect(activityGenerationWorkflow).not.toHaveBeenCalled();
  });

  test("propagates errors from activityGenerationWorkflow", async () => {
    vi.mocked(activityGenerationWorkflow).mockRejectedValueOnce(new Error("activity gen failed"));

    await expect(lessonPreloadWorkflow(lessonId)).rejects.toThrow("activity gen failed");
    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(lessonId);
  });
});
