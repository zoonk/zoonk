import { hasActiveSubscription } from "@zoonk/core/auth/subscription";
import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerChapterGeneration } from "./trigger-chapter-generation";
import { triggerLessonPreload } from "./trigger-lesson-preload";
import { triggerPreloadTarget } from "./trigger-preload-target";

vi.mock("@zoonk/core/auth/subscription", () => ({ hasActiveSubscription: vi.fn() }));
vi.mock("./trigger-chapter-generation", () => ({ triggerChapterGeneration: vi.fn() }));
vi.mock("./trigger-lesson-preload", () => ({ triggerLessonPreload: vi.fn() }));

const cookieHeader = "session=test";
const requestHeaders = new Headers({ cookie: cookieHeader });
const hasActiveSubscriptionMock = vi.mocked(hasActiveSubscription);
const triggerChapterGenerationMock = vi.mocked(triggerChapterGeneration);
const triggerLessonPreloadMock = vi.mocked(triggerLessonPreload);

describe(triggerPreloadTarget, () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("triggers lesson preload without checking subscription", async () => {
    await triggerPreloadTarget({
      cookieHeader,
      requestHeaders,
      target: { kind: "lesson", lessonId: "lesson-1" },
    });

    expect(triggerLessonPreloadMock).toHaveBeenCalledWith({ cookieHeader, lessonId: "lesson-1" });
    expect(hasActiveSubscriptionMock).not.toHaveBeenCalled();
    expect(triggerChapterGenerationMock).not.toHaveBeenCalled();
  });

  it("does not trigger chapter generation without an active subscription", async () => {
    hasActiveSubscriptionMock.mockResolvedValue(false);

    await triggerPreloadTarget({
      cookieHeader,
      requestHeaders,
      target: { chapterId: "chapter-1", kind: "chapter" },
    });

    expect(hasActiveSubscriptionMock).toHaveBeenCalledWith(requestHeaders);
    expect(triggerChapterGenerationMock).not.toHaveBeenCalled();
    expect(triggerLessonPreloadMock).not.toHaveBeenCalled();
  });

  it("triggers chapter generation with an active subscription", async () => {
    hasActiveSubscriptionMock.mockResolvedValue(true);

    await triggerPreloadTarget({
      cookieHeader,
      requestHeaders,
      target: { chapterId: "chapter-1", kind: "chapter" },
    });

    expect(triggerChapterGenerationMock).toHaveBeenCalledWith({
      chapterId: "chapter-1",
      cookieHeader,
    });

    expect(triggerLessonPreloadMock).not.toHaveBeenCalled();
  });
});
