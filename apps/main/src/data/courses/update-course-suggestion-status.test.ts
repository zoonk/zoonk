import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { toSlug } from "@zoonk/utils/string";
import { describe, expect, test } from "vitest";
import { updateCourseSuggestionStatus } from "./update-course-suggestion-status";

describe(updateCourseSuggestionStatus, () => {
  test("updates generation status", async () => {
    const title = `test-course-${randomUUID()}`;
    const suggestion = await prisma.courseSuggestion.create({
      data: {
        description: "Test description",
        language: "en",
        slug: toSlug(title),
        title,
      },
    });

    expect(suggestion.generationStatus).toBe("pending");

    const result = await updateCourseSuggestionStatus({
      generationStatus: "running",
      id: suggestion.id,
    });

    expect(result.error).toBeNull();

    const updated = await prisma.courseSuggestion.findUnique({
      where: { id: suggestion.id },
    });

    expect(updated?.generationStatus).toBe("running");
  });

  test("updates generation run id", async () => {
    const title = `test-course-${randomUUID()}`;
    const runId = randomUUID();

    const suggestion = await prisma.courseSuggestion.create({
      data: {
        description: "Test description",
        language: "en",
        slug: toSlug(title),
        title,
      },
    });

    const result = await updateCourseSuggestionStatus({
      generationRunId: runId,
      generationStatus: "running",
      id: suggestion.id,
    });

    expect(result.error).toBeNull();

    const updated = await prisma.courseSuggestion.findUnique({
      where: { id: suggestion.id },
    });

    expect(updated?.generationRunId).toBe(runId);
    expect(updated?.generationStatus).toBe("running");
  });

  test("returns error for non-existent suggestion", async () => {
    const result = await updateCourseSuggestionStatus({
      generationStatus: "running",
      id: 999_999,
    });

    expect(result.error).not.toBeNull();
  });
});
