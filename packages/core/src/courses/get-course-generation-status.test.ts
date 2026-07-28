import { randomUUID } from "node:crypto";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { describe, expect, it } from "vitest";
import { getCourseGenerationStatus } from "./get-course-generation-status";

describe(getCourseGenerationStatus, () => {
  it("returns the current generation status", async () => {
    const course = await courseFixture({ generationStatus: "running" });

    await expect(getCourseGenerationStatus({ courseId: course.id })).resolves.toBe("running");
  });

  it("returns null for missing and malformed course ids", async () => {
    await expect(getCourseGenerationStatus({ courseId: randomUUID() })).resolves.toBeNull();
    await expect(getCourseGenerationStatus({ courseId: "invalid-id" })).resolves.toBeNull();
  });
});
