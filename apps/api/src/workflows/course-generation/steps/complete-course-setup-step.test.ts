import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { getRejectedAggregateError } from "@/workflows/_test-utils/rejected-error";
import { prisma } from "@zoonk/db";
import { courseSuggestionFixture } from "@zoonk/testing/fixtures/course-suggestions";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { completeCourseSetupStep } from "./complete-course-setup-step";

describe(completeCourseSetupStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws all DB save failures without streaming error", async () => {
    const promise = completeCourseSetupStep({
      courseId: randomUUID(),
      courseSlug: `missing-course-${randomUUID()}`,
      courseSuggestionId: randomUUID(),
    });

    const error = await getRejectedAggregateError(promise);

    expect(error.errors).toHaveLength(2);

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "completeCourseSetup" }),
    );
  });

  it("marks both course and suggestion as completed", async () => {
    const [course, suggestion] = await Promise.all([
      courseFixture({
        generationStatus: "running",
        organizationId,
        title: `Complete Setup ${randomUUID()}`,
      }),
      courseSuggestionFixture({
        generationStatus: "running",
        title: `Complete Suggestion ${randomUUID()}`,
      }),
    ]);

    await completeCourseSetupStep({
      courseId: course.id,
      courseSlug: course.slug,
      courseSuggestionId: suggestion.id,
    });

    const [updatedCourse, updatedSuggestion] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseSuggestion.findUniqueOrThrow({ where: { id: suggestion.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("completed");
    expect(updatedSuggestion.generationStatus).toBe("completed");
    expect(updatedSuggestion.courseId).toBe(course.id);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "completeCourseSetup" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        entityId: course.slug,
        status: "completed",
        step: "completeCourseSetup",
      }),
    );
  });

  it("marks linked suggestions as completed when another run finishes the course", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Linked Complete Setup ${randomUUID()}`,
    });

    const [primarySuggestion, linkedSuggestion] = await Promise.all([
      courseSuggestionFixture({
        courseId: course.id,
        generationStatus: "running",
        title: `Primary Complete Suggestion ${randomUUID()}`,
      }),
      courseSuggestionFixture({
        courseId: course.id,
        generationRunId: "other-run",
        generationStatus: "running",
        title: `Linked Complete Suggestion ${randomUUID()}`,
      }),
    ]);

    await completeCourseSetupStep({
      courseId: course.id,
      courseSlug: course.slug,
      courseSuggestionId: primarySuggestion.id,
    });

    const updatedLinkedSuggestion = await prisma.courseSuggestion.findUniqueOrThrow({
      where: { id: linkedSuggestion.id },
    });

    expect(updatedLinkedSuggestion.generationStatus).toBe("completed");
  });
});
