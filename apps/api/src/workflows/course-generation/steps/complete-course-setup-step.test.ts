import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { getRejectedAggregateError } from "@/workflows/_test-utils/rejected-error";
import { prisma } from "@zoonk/db";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
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
      courseStartRequestId: randomUUID(),
    });

    const error = await getRejectedAggregateError(promise);

    expect(error.errors).toHaveLength(2);

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "completeCourseSetup" }),
    );
  });

  it("marks both course and request as completed", async () => {
    const [course, request] = await Promise.all([
      courseFixture({
        generationStatus: "running",
        organizationId,
        title: `Complete Setup ${randomUUID()}`,
      }),
      courseStartRequestFixture({
        canonicalTitle: `Complete Request ${randomUUID()}`,
        generationStatus: "running",
      }),
    ]);

    await completeCourseSetupStep({
      courseId: course.id,
      courseSlug: course.slug,
      courseStartRequestId: request.id,
    });

    const [updatedCourse, updatedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseStartRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("completed");
    expect(updatedRequest.generationStatus).toBe("completed");
    expect(updatedRequest.courseId).toBe(course.id);

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

  it("marks linked requests as completed when another run finishes the course", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Linked Complete Setup ${randomUUID()}`,
    });

    const [primaryRequest, linkedRequest] = await Promise.all([
      courseStartRequestFixture({
        canonicalTitle: `Primary Complete Request ${randomUUID()}`,
        courseId: course.id,
        generationStatus: "running",
      }),
      courseStartRequestFixture({
        canonicalTitle: `Linked Complete Request ${randomUUID()}`,
        courseId: course.id,
        generationRunId: "other-run",
        generationStatus: "running",
      }),
    ]);

    await completeCourseSetupStep({
      courseId: course.id,
      courseSlug: course.slug,
      courseStartRequestId: primaryRequest.id,
    });

    const updatedLinkedRequest = await prisma.courseStartRequest.findUniqueOrThrow({
      where: { id: linkedRequest.id },
    });

    expect(updatedLinkedRequest.generationStatus).toBe("completed");
  });
});
