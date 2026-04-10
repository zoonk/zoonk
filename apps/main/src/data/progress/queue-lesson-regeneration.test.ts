import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { queueLessonRegeneration } from "./queue-lesson-regeneration";
import { triggerLessonPreload } from "./trigger-lesson-preload";

vi.mock("./trigger-lesson-preload", () => ({
  triggerLessonPreload: vi.fn(),
}));

describe(queueLessonRegeneration, () => {
  beforeEach(() => {
    vi.mocked(triggerLessonPreload).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("calls lesson preload when an ai lesson is outdated and completed", async () => {
    await queueLessonRegeneration({
      cookieHeader: "session=abc123",
      lesson: {
        generationStatus: "completed",
        generationVersion: 0,
        id: 42,
        kind: "core",
        managementMode: "ai",
      },
    });

    expect(triggerLessonPreload).toHaveBeenCalledWith({
      cookieHeader: "session=abc123",
      lessonId: 42,
    });
  });

  test("does not call lesson preload for current lessons", async () => {
    await queueLessonRegeneration({
      cookieHeader: "session=abc123",
      lesson: {
        generationStatus: "completed",
        generationVersion: 1,
        id: 42,
        kind: "core",
        managementMode: "ai",
      },
    });

    expect(triggerLessonPreload).not.toHaveBeenCalled();
  });

  test("calls lesson preload when an ai lesson is outdated and failed", async () => {
    await queueLessonRegeneration({
      cookieHeader: "session=abc123",
      lesson: {
        generationStatus: "failed",
        generationVersion: 0,
        id: 42,
        kind: "core",
        managementMode: "ai",
      },
    });

    expect(triggerLessonPreload).toHaveBeenCalledWith({
      cookieHeader: "session=abc123",
      lessonId: 42,
    });
  });

  test("does not call lesson preload for manual lessons", async () => {
    await queueLessonRegeneration({
      cookieHeader: "session=abc123",
      lesson: {
        generationStatus: "completed",
        generationVersion: 0,
        id: 42,
        kind: "core",
        managementMode: "manual",
      },
    });

    expect(triggerLessonPreload).not.toHaveBeenCalled();
  });
});
