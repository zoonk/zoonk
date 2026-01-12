import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  courseFixture,
  courseSuggestionFixture,
} from "@zoonk/testing/fixtures/courses";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, test } from "vitest";
import { createCourseGenerationRun } from "./create-course-generation-run";
import { updateCourseGenerationRun } from "./update-course-generation-run";

describe("updateCourseGenerationRun", () => {
  test("updates status to completed", async () => {
    const suggestion = await courseSuggestionFixture();
    const runId = randomUUID();

    await createCourseGenerationRun({
      courseSuggestionId: suggestion.id,
      runId,
      title: "Test Course",
    });

    await updateCourseGenerationRun({
      runId,
      status: "completed",
    });

    const run = await prisma.courseGenerationRun.findUnique({
      where: { runId },
    });

    expect(run?.status).toBe("completed");
  });

  test("updates status to failed", async () => {
    const suggestion = await courseSuggestionFixture();
    const runId = randomUUID();

    await createCourseGenerationRun({
      courseSuggestionId: suggestion.id,
      runId,
      title: "Test Course",
    });

    await updateCourseGenerationRun({
      runId,
      status: "failed",
    });

    const run = await prisma.courseGenerationRun.findUnique({
      where: { runId },
    });

    expect(run?.status).toBe("failed");
  });

  test("updates courseId when provided", async () => {
    const suggestion = await courseSuggestionFixture();
    const org = await organizationFixture();
    const course = await courseFixture({ organizationId: org.id });
    const runId = randomUUID();

    await createCourseGenerationRun({
      courseSuggestionId: suggestion.id,
      runId,
      title: "Test Course",
    });

    await updateCourseGenerationRun({
      courseId: course.id,
      runId,
      status: "completed",
    });

    const run = await prisma.courseGenerationRun.findUnique({
      where: { runId },
    });

    expect(run?.status).toBe("completed");
    expect(run?.courseId).toBe(course.id);
  });
});
