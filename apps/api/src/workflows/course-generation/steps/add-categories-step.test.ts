import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { addCategoriesStep } from "./add-categories-step";
import { type CourseContext } from "./initialize-course-step";

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

describe(addCategoriesStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates categories in the database", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Categories Course ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await addCategoriesStep({
      categories: ["programming", "web"],
      course: courseContext,
    });

    const dbCategories = await prisma.courseCategory.findMany({
      where: { courseId: course.id },
    });

    expect(dbCategories).toHaveLength(2);
    expect(dbCategories.map((cat) => cat.category).toSorted()).toEqual(["programming", "web"]);

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "addCategories" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "addCategories" }),
    );
  });

  test("skips duplicate categories without error", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Dup Categories Course ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await addCategoriesStep({
      categories: ["programming"],
      course: courseContext,
    });

    await addCategoriesStep({
      categories: ["programming", "web"],
      course: courseContext,
    });

    const dbCategories = await prisma.courseCategory.findMany({
      where: { courseId: course.id },
    });

    expect(dbCategories).toHaveLength(2);
  });
});
