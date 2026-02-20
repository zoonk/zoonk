import { API_URL } from "@zoonk/utils/constants";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getNextLessonId } from "./get-next-lesson-id";
import { preloadNextLesson } from "./preload-next-lesson";

vi.mock("./get-next-lesson-id", () => ({
  getNextLessonId: vi.fn(),
}));

describe(preloadNextLesson, () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  test("calls API with correct lessonId and cookie when next lesson exists", async () => {
    vi.mocked(getNextLessonId).mockResolvedValue(42);

    await preloadNextLesson(BigInt(1), "session=abc123");

    expect(mockFetch).toHaveBeenCalledWith(`${API_URL}/v1/workflows/lesson-preload/trigger`, {
      body: JSON.stringify({ lessonId: 42 }),
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=abc123",
      },
      method: "POST",
    });
  });

  test("does not call API when no next lesson exists", async () => {
    vi.mocked(getNextLessonId).mockResolvedValue(null);

    await preloadNextLesson(BigInt(1), "session=abc123");

    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("silently handles fetch errors without throwing", async () => {
    vi.mocked(getNextLessonId).mockResolvedValue(42);
    mockFetch.mockRejectedValue(new Error("network error"));

    await expect(preloadNextLesson(BigInt(1), "session=abc123")).resolves.toBeUndefined();
  });
});
