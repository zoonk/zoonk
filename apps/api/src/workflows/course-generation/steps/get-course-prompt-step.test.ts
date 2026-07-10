import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { coursePromptFixture } from "@zoonk/testing/fixtures/course-prompts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCoursePromptStep } from "./get-course-prompt-step";

describe(getCoursePromptStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the course prompt by ID", async () => {
    const request = await coursePromptFixture({ canonicalTitle: `Start Request ${randomUUID()}` });

    const result = await getCoursePromptStep(request.id);

    expect(result.id).toBe(request.id);
    expect(result.canonicalTitle).toBe(request.canonicalTitle);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "getCoursePrompt" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "getCoursePrompt" }),
    );
  });

  it("throws FatalError when request does not exist", async () => {
    await expect(getCoursePromptStep(randomUUID())).rejects.toThrow("Course prompt not found");

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "getCoursePrompt" }),
    );
  });

  it("throws FatalError when a language request uses the same user and target language", async () => {
    const request = await coursePromptFixture({
      canonicalTitle: `Same Language Request ${randomUUID()}`,
      courseFormat: "language",
      language: "en",
      targetLanguage: "en",
    });

    await expect(getCoursePromptStep(request.id)).rejects.toThrow(
      "Language course source and target languages must be different",
    );
  });

  it.each(["", "es"])(
    "throws FatalError when a core request has target language %j",
    async (targetLanguage) => {
      const request = await coursePromptFixture({
        canonicalTitle: `Invalid Core Request ${randomUUID()}`,
        courseFormat: "core",
        targetLanguage,
      });

      await expect(getCoursePromptStep(request.id)).rejects.toThrow(
        "Course prompt is not generatable",
      );
    },
  );
});
