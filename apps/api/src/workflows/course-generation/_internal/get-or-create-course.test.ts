import { randomUUID } from "node:crypto";
import { getCourseSlugForTitle } from "@zoonk/core/courses/slug";
import { prisma } from "@zoonk/db";
import { generatableCourseStartRequestFixture } from "@zoonk/testing/fixtures/course-start-requests";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type ExistingCourse } from "../steps/resolve-course-identity-step";
import { getOrCreateCourse } from "./get-or-create-course";

describe(getOrCreateCourse, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new course when no existing course is found", async () => {
    const request = await generatableCourseStartRequestFixture({
      canonicalTitle: `New Course ${randomUUID()}`,
    });

    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse(null, request, request.id, workflowRunId);

    expect(result.status).toBe("ready");
    expect(result.course.courseTitle).toBe(request.canonicalTitle);
    expect(result.course.courseId).toStrictEqual(expect.any(String));

    expect(result.existing).toStrictEqual({
      description: null,
      hasCategories: false,
      hasChapters: false,
      imageUrl: null,
    });

    const createdCourse = await prisma.course.findUniqueOrThrow({
      where: { id: result.course.courseId },
    });

    const updatedRequest = await prisma.courseStartRequest.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(createdCourse.generationStatus).toBe("running");
    expect(updatedRequest.courseId).toBe(createdCourse.id);
  });

  it("returns the running course when creation loses an org slug race", async () => {
    const title = `Concurrent Course ${randomUUID()}`;
    const language = "en";
    const slug = getCourseSlugForTitle({ language, title });

    const existingCourse = await courseFixture({
      generationStatus: "running",
      language,
      organizationId,
      slug,
      title,
    });

    const request = await generatableCourseStartRequestFixture({ canonicalTitle: title, language });
    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse(null, request, request.id, workflowRunId);

    expect(result.status).toBe("running");
    expect(result.course.courseId).toBe(existingCourse.id);

    const [courses, updatedRequest] = await Promise.all([
      prisma.course.findMany({ where: { organizationId, slug } }),
      prisma.courseStartRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(courses).toHaveLength(1);
    expect(updatedRequest.courseId).toBe(existingCourse.id);
    expect(updatedRequest.generationStatus).toBe("running");
    expect(updatedRequest.generationRunId).toBe(workflowRunId);
  });

  it("reuses existing course and marks it as running", async () => {
    const course = await courseFixture({
      description: "Existing description",
      generationStatus: "failed",
      imageUrl: "https://example.com/img.webp",
      organizationId,
      title: `Existing Course ${randomUUID()}`,
    });

    const request = await generatableCourseStartRequestFixture({ canonicalTitle: course.title });

    const existingCourse: ExistingCourse = { ...course, _count: { categories: 1, chapters: 3 } };

    const workflowRunId = `run-${randomUUID()}`;

    const result = await getOrCreateCourse(existingCourse, request, request.id, workflowRunId);

    expect(result.status).toBe("ready");
    expect(result.course.courseId).toBe(course.id);

    expect(result.existing).toStrictEqual({
      description: "Existing description",
      hasCategories: true,
      hasChapters: true,
      imageUrl: "https://example.com/img.webp",
    });

    const [updatedCourse, updatedRequest] = await Promise.all([
      prisma.course.findUniqueOrThrow({ where: { id: course.id } }),
      prisma.courseStartRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ]);

    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedRequest.courseId).toBe(course.id);
    expect(updatedRequest.generationStatus).toBe("running");
    expect(updatedRequest.generationRunId).toBe(workflowRunId);
  });
});
