import { randomUUID } from "node:crypto";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/courses";
import { describe, expect, test } from "vitest";
import { createCourseGenerationRun } from "./create-course-generation-run";
import { getCourseGenerationRun } from "./get-course-generation-run";

describe("getCourseGenerationRun", () => {
  test("returns run by runId", async () => {
    const suggestion = await courseSuggestionFixture();
    const runId = randomUUID();

    await createCourseGenerationRun({
      courseSuggestionId: suggestion.id,
      runId,
      title: "Test Course",
    });

    const run = await getCourseGenerationRun(runId);

    expect(run).toBeDefined();
    expect(run?.runId).toBe(runId);
    expect(run?.courseSuggestionId).toBe(suggestion.id);
    expect(run?.title).toBe("Test Course");
    expect(run?.status).toBe("running");
  });

  test("returns null for non-existent runId", async () => {
    const run = await getCourseGenerationRun("non-existent-run-id");
    expect(run).toBeNull();
  });
});
