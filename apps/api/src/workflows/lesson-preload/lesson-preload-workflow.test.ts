import { getLessonGenerationState } from "@zoonk/core/content/management";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { activityGenerationWorkflow } from "../activity-generation/activity-generation-workflow";
import { lessonGenerationWorkflow } from "../lesson-generation/lesson-generation-workflow";
import { getLessonStep } from "../lesson-generation/steps/get-lesson-step";
import { lessonRegenerationWorkflow } from "../lesson-regeneration/lesson-regeneration-workflow";
import { lessonPreloadWorkflow } from "./lesson-preload-workflow";

vi.mock("../lesson-generation/steps/get-lesson-step", () => ({
  getLessonStep: vi.fn(),
}));

vi.mock("@zoonk/core/content/management", () => ({
  getLessonGenerationState: vi.fn(),
}));

vi.mock("../lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: vi.fn().mockResolvedValue("ready"),
}));

vi.mock("../activity-generation/activity-generation-workflow", () => ({
  activityGenerationWorkflow: vi.fn().mockImplementation(async () => {}),
}));

vi.mock("../lesson-regeneration/lesson-regeneration-workflow", () => ({
  lessonRegenerationWorkflow: vi.fn().mockImplementation(async () => {}),
}));

describe(lessonPreloadWorkflow, () => {
  const initialLesson = {
    generationVersion: null,
    id: "42",
    managementMode: "ai",
  };
  const outdatedLesson = {
    ...initialLesson,
    generationVersion: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getLessonStep).mockResolvedValue({
      ...initialLesson,
      generationVersion: null,
      managementMode: "ai",
    } as Awaited<ReturnType<typeof getLessonStep>>);
    vi.mocked(getLessonGenerationState).mockReturnValue({
      hasGenerationVersionMismatch: false,
      shouldAutoEnqueueRegeneration: false,
    } as ReturnType<typeof getLessonGenerationState>);
  });

  test("runs safe regeneration when the live lesson is outdated and eligible", async () => {
    vi.mocked(getLessonStep).mockResolvedValue(
      outdatedLesson as Awaited<ReturnType<typeof getLessonStep>>,
    );
    vi.mocked(getLessonGenerationState).mockReturnValue({
      hasGenerationVersionMismatch: true,
      shouldAutoEnqueueRegeneration: true,
    } as ReturnType<typeof getLessonGenerationState>);

    await lessonPreloadWorkflow(initialLesson.id);

    expect(lessonRegenerationWorkflow).toHaveBeenCalledWith({ liveLesson: outdatedLesson });
    expect(lessonGenerationWorkflow).not.toHaveBeenCalled();
    expect(activityGenerationWorkflow).not.toHaveBeenCalled();
  });

  test("does nothing for outdated lessons that already have regeneration in progress", async () => {
    vi.mocked(getLessonStep).mockResolvedValue(
      outdatedLesson as Awaited<ReturnType<typeof getLessonStep>>,
    );
    vi.mocked(getLessonGenerationState).mockReturnValue({
      hasGenerationVersionMismatch: true,
      shouldAutoEnqueueRegeneration: false,
    } as ReturnType<typeof getLessonGenerationState>);

    await lessonPreloadWorkflow(initialLesson.id);

    expect(lessonRegenerationWorkflow).not.toHaveBeenCalled();
    expect(lessonGenerationWorkflow).not.toHaveBeenCalled();
    expect(activityGenerationWorkflow).not.toHaveBeenCalled();
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

    await lessonPreloadWorkflow(initialLesson.id);

    expect(getLessonStep).toHaveBeenCalledWith(initialLesson.id);
    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(initialLesson.id);
    expect(activityGenerationWorkflow).toHaveBeenCalledWith(initialLesson.id);
    expect(callOrder).toEqual(["lessonGeneration", "activityGeneration"]);
  });

  test("skips activity generation when lesson generation filters the lesson", async () => {
    vi.mocked(lessonGenerationWorkflow).mockResolvedValueOnce("filtered");

    await lessonPreloadWorkflow(initialLesson.id);

    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(initialLesson.id);
    expect(activityGenerationWorkflow).not.toHaveBeenCalled();
  });

  test("propagates errors from lessonGenerationWorkflow", async () => {
    vi.mocked(lessonGenerationWorkflow).mockRejectedValueOnce(new Error("lesson gen failed"));

    await expect(lessonPreloadWorkflow(initialLesson.id)).rejects.toThrow("lesson gen failed");
    expect(activityGenerationWorkflow).not.toHaveBeenCalled();
  });

  test("propagates errors from activityGenerationWorkflow", async () => {
    vi.mocked(activityGenerationWorkflow).mockRejectedValueOnce(new Error("activity gen failed"));

    await expect(lessonPreloadWorkflow(initialLesson.id)).rejects.toThrow("activity gen failed");
    expect(lessonGenerationWorkflow).toHaveBeenCalledWith(initialLesson.id);
  });
});
