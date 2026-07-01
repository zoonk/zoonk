import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type CourseContext } from "./initialize-course-step";
import { updateCourseStep } from "./update-course-step";

describe(updateCourseStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws without streaming error when course does not exist", async () => {
    const brokenContext: CourseContext = {
      courseId: randomUUID(),
      courseSlug: "broken",
      courseTitle: "Broken",
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await expect(
      updateCourseStep({
        course: brokenContext,
        description: "desc",
        imageUrl: null,
        landingPage: {
          audience: ["Audience"],
          opportunities: ["Opportunity"],
          outcomes: ["Outcome"],
          valueProposition: "Value.",
        },
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "updateCourse" }),
    );
  });

  it("updates course description and image without completing setup", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Update Course ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await updateCourseStep({
      course: courseContext,
      description: "Updated description",
      imageUrl: "https://example.com/image.webp",
      landingPage: {
        audience: ["New learners"],
        opportunities: ["Use this in real projects"],
        outcomes: ["Build practical skill"],
        valueProposition: "A clear path into the subject.",
      },
    });

    const updated = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(updated.description).toBe("Updated description");
    expect(updated.imageUrl).toBe("https://example.com/image.webp");

    expect(updated.landingPage).toStrictEqual({
      audience: ["New learners"],
      opportunities: ["Use this in real projects"],
      outcomes: ["Build practical skill"],
      valueProposition: "A clear path into the subject.",
    });

    expect(updated.generationStatus).toBe("running");

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "updateCourse" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "updateCourse" }),
    );
  });

  it("does not update imageUrl when it is null", async () => {
    const course = await courseFixture({
      imageUrl: "https://example.com/existing.webp",
      organizationId,
      title: `Update No Image ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    await updateCourseStep({
      course: courseContext,
      description: "Updated description",
      imageUrl: null,
      landingPage: {
        audience: ["New learners"],
        opportunities: ["Use this in real projects"],
        outcomes: ["Build practical skill"],
        valueProposition: "A clear path into the subject.",
      },
    });

    const updated = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(updated.description).toBe("Updated description");
    expect(updated.imageUrl).toBe("https://example.com/existing.webp");
  });
});
