import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getNextLesson } from "./get-next-lesson";
import { preloadNextLesson } from "./preload-next-lesson";
import { triggerLessonPreload } from "./trigger-lesson-preload";

vi.mock("./get-next-lesson", () => ({
  getNextLesson: vi.fn(),
}));

vi.mock("./trigger-lesson-preload", () => ({
  triggerLessonPreload: vi.fn(),
}));

describe(preloadNextLesson, () => {
  beforeEach(() => {
    vi.mocked(triggerLessonPreload).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("calls API with correct lessonId and cookie when next lesson needs generation", async () => {
    vi.mocked(getNextLesson).mockResolvedValue({ id: 42, needsGeneration: true });

    await preloadNextLesson(BigInt(1), "session=abc123");

    expect(triggerLessonPreload).toHaveBeenCalledWith({
      cookieHeader: "session=abc123",
      lessonId: 42,
    });
  });

  test("does not call API when no next lesson exists", async () => {
    vi.mocked(getNextLesson).mockResolvedValue(null);

    await preloadNextLesson(BigInt(1), "session=abc123");

    expect(triggerLessonPreload).not.toHaveBeenCalled();
  });

  test("does not call API when next lesson does not need generation", async () => {
    vi.mocked(getNextLesson).mockResolvedValue({ id: 42, needsGeneration: false });

    await preloadNextLesson(BigInt(1), "session=abc123");

    expect(triggerLessonPreload).not.toHaveBeenCalled();
  });

  test("silently handles fetch errors without throwing", async () => {
    vi.mocked(getNextLesson).mockResolvedValue({ id: 42, needsGeneration: true });
    vi.mocked(triggerLessonPreload).mockRejectedValue(new Error("network error"));

    await expect(preloadNextLesson(BigInt(1), "session=abc123")).resolves.toBeUndefined();
  });
});
