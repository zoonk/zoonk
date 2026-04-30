import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCourseSuggestionStep } from "./get-course-suggestion-step";

describe(getCourseSuggestionStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the course suggestion by ID", async () => {
    const suggestion = await courseSuggestionFixture({ title: `Suggestion ${randomUUID()}` });

    const result = await getCourseSuggestionStep(suggestion.id);

    expect(result.id).toBe(suggestion.id);
    expect(result.title).toBe(suggestion.title);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "getCourseSuggestion" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "getCourseSuggestion" }),
    );
  });

  it("throws FatalError when suggestion does not exist", async () => {
    await expect(getCourseSuggestionStep(randomUUID())).rejects.toThrow(
      "Course suggestion not found",
    );

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "getCourseSuggestion" }),
    );
  });
});
