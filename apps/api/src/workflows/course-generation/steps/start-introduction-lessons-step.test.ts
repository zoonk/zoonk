import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import { logError } from "@zoonk/utils/logger";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startIntroductionLessonsStep } from "./start-introduction-lessons-step";

const { startMock } = vi.hoisted(() => ({ startMock: vi.fn() }));

vi.mock("workflow/api", () => ({ start: startMock }));

vi.mock("@/workflows/lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: vi.fn(),
}));

vi.mock("@zoonk/utils/logger", () => ({ logError: vi.fn() }));

describe(startIntroductionLessonsStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    startMock
      .mockResolvedValueOnce({ runId: "first-run" })
      .mockResolvedValueOnce({ runId: "second-run" });
  });

  it("enqueues each intro lesson workflow without waiting for lesson output", async () => {
    const result = await startIntroductionLessonsStep({
      lessons: [{ id: "lesson-1" }, { id: "lesson-2" }],
    });

    expect(result).toStrictEqual(["first-run", "second-run"]);

    expect(startMock).toHaveBeenCalledWith(lessonGenerationWorkflow, ["lesson-1"]);
    expect(startMock).toHaveBeenCalledWith(lessonGenerationWorkflow, ["lesson-2"]);
  });

  it("keeps course setup moving when one warmup workflow cannot be enqueued", async () => {
    startMock
      .mockReset()
      .mockResolvedValueOnce({ runId: "first-run" })
      .mockRejectedValueOnce(new Error("workflow queue unavailable"));

    const result = await startIntroductionLessonsStep({
      lessons: [{ id: "lesson-1" }, { id: "lesson-2" }],
    });

    expect(result).toStrictEqual(["first-run"]);

    expect(logError).toHaveBeenCalledWith(
      "Intro lesson workflow failed to start",
      expect.any(Error),
    );
  });
});
