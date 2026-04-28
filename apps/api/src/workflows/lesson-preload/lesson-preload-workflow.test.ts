import { beforeEach, describe, expect, test, vi } from "vitest";
import { lessonGenerationWorkflow } from "../lesson-generation/lesson-generation-workflow";
import { lessonPreloadWorkflow } from "./lesson-preload-workflow";

vi.mock("../lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: vi.fn().mockResolvedValue("ready"),
}));

describe(lessonPreloadWorkflow, () => {
  const lessonId = "42";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls lessonGenerationWorkflow", async () => {
    await lessonPreloadWorkflow(lessonId);

    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(lessonId);
  });

  test("allows filtered lesson generation results", async () => {
    vi.mocked(lessonGenerationWorkflow).mockResolvedValueOnce("filtered");

    await lessonPreloadWorkflow(lessonId);

    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(lessonId);
  });

  test("propagates errors from lessonGenerationWorkflow", async () => {
    vi.mocked(lessonGenerationWorkflow).mockRejectedValueOnce(new Error("lesson gen failed"));

    await expect(lessonPreloadWorkflow(lessonId)).rejects.toThrow("lesson gen failed");
    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(lessonId);
  });
});
