import { track as trackVercelEvent } from "@vercel/analytics/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerPostHogClient } from "./server-posthog";
import { trackGenerationRateLimited } from "./server-track-events";

vi.mock("@vercel/analytics/server", () => ({ track: vi.fn() }));
vi.mock("./server-posthog", () => ({ createServerPostHogClient: vi.fn() }));

const capture = vi.fn();
const shutdown = vi.fn();

describe(trackGenerationRateLimited, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createServerPostHogClient).mockReturnValue({
      [Symbol.asyncDispose]: shutdown,
      capture,
    });
  });

  it.each([
    {
      expectedTarget: { coursePromptId: "course-prompt-id" },
      resource: "course" as const,
      target: { coursePromptId: "course-prompt-id" },
    },
    {
      expectedTarget: { courseSlug: "course-slug" },
      resource: "course" as const,
      target: { coursePromptId: "course-prompt-id", courseSlug: "course-slug" },
    },
    {
      expectedTarget: { chapterSlug: "chapter-slug", courseSlug: "course-slug" },
      resource: "chapter" as const,
      target: { chapterSlug: "chapter-slug", courseSlug: "course-slug" },
    },
    {
      expectedTarget: {
        chapterSlug: "chapter-slug",
        courseSlug: "course-slug",
        lessonSlug: "lesson-slug",
      },
      resource: "lesson" as const,
      target: { chapterSlug: "chapter-slug", courseSlug: "course-slug", lessonSlug: "lesson-slug" },
    },
  ])("tracks a rate-limited $resource generation", async ({ expectedTarget, resource, target }) => {
    const properties = {
      period: "day",
      resource,
      username: "learner",
      viewer: "authenticated",
      ...expectedTarget,
    };

    await trackGenerationRateLimited({
      actor: { distinctId: "user-id", username: "learner" },
      limit: { period: "day", resource, viewer: "authenticated" },
      target,
    });

    expect(trackVercelEvent).toHaveBeenCalledExactlyOnceWith("Generation Rate Limited", properties);

    expect(capture).toHaveBeenCalledExactlyOnceWith({
      distinctId: "user-id",
      event: "Generation Rate Limited",
      properties,
    });

    expect(shutdown).toHaveBeenCalledOnce();
  });
});
