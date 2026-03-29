import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getCourseSuggestionStep } from "./get-course-suggestion-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(getCourseSuggestionStep, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the course suggestion by ID", async () => {
    const suggestion = await courseSuggestionFixture({
      title: `Suggestion ${randomUUID()}`,
    });

    const result = await getCourseSuggestionStep(suggestion.id);

    expect(result.id).toBe(suggestion.id);
    expect(result.title).toBe(suggestion.title);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "getCourseSuggestion" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "getCourseSuggestion" }),
    );
  });

  test("throws FatalError when suggestion does not exist", async () => {
    await expect(getCourseSuggestionStep(999_999_999)).rejects.toThrow(
      "Course suggestion not found",
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "getCourseSuggestion" }),
    );
  });
});
