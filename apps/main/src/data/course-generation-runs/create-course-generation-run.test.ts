import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/courses";
import { describe, expect, test } from "vitest";
import { createCourseGenerationRun } from "./create-course-generation-run";

describe("createCourseGenerationRun", () => {
  test("creates a new run record with running status", async () => {
    const suggestion = await courseSuggestionFixture();
    const runId = randomUUID();

    const result = await createCourseGenerationRun({
      courseSuggestionId: suggestion.id,
      runId,
      title: "Test Course",
    });

    expect(result.id).toBeDefined();

    const run = await prisma.courseGenerationRun.findUnique({
      where: { id: result.id },
    });

    expect(run).toBeDefined();
    expect(run?.runId).toBe(runId);
    expect(run?.courseSuggestionId).toBe(suggestion.id);
    expect(run?.title).toBe("Test Course");
    expect(run?.status).toBe("running");
    expect(run?.courseId).toBeNull();
  });

  test("creates run with unique runId constraint", async () => {
    const suggestion = await courseSuggestionFixture();
    const runId = randomUUID();

    await createCourseGenerationRun({
      courseSuggestionId: suggestion.id,
      runId,
      title: "Test Course 1",
    });

    await expect(
      createCourseGenerationRun({
        courseSuggestionId: suggestion.id,
        runId,
        title: "Test Course 2",
      }),
    ).rejects.toThrow();
  });
});
