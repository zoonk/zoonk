import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { getRejectedAggregateError } from "@/workflows/_test-utils/rejected-error";
import { prisma } from "@zoonk/db";
import { courseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { setCourseAsRunningStep } from "./set-course-as-running-step";

describe(setCourseAsRunningStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws all DB save failures without streaming error", async () => {
    const promise = setCourseAsRunningStep({
      courseId: randomUUID(),
      courseStartRequestId: randomUUID(),
      workflowRunId: "run-id",
    });

    const error = await getRejectedAggregateError(promise);

    expect(error.errors).toHaveLength(2);

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "setCourseAsRunning" }),
    );
  });

  it("marks both course and request as running", async () => {
    const [course, request] = await Promise.all([
      courseFixture({ organizationId, title: `Set Running ${randomUUID()}` }),
      courseStartRequestFixture({ canonicalTitle: `Running Request ${randomUUID()}` }),
    ]);

    const workflowRunId = `run-${randomUUID()}`;

    await setCourseAsRunningStep({
      courseId: course.id,
      courseStartRequestId: request.id,
      workflowRunId,
    });

    const [updatedCourse, updatedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseStartRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedRequest.generationStatus).toBe("running");
    expect(updatedRequest.generationRunId).toBe(workflowRunId);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "setCourseAsRunning" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "setCourseAsRunning" }),
    );
  });
});
