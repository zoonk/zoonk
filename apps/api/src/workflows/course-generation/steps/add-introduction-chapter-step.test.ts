import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { addIntroductionChapterStep } from "./add-introduction-chapter-step";
import { type CourseContext } from "./initialize-course-step";

describe(addIntroductionChapterStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Builds the regular-course context required by the intro chapter step. The
   * step intentionally excludes language courses, so every caller should pass a
   * context with targetLanguage already narrowed to null.
   */
  function getCourseContext(course: Awaited<ReturnType<typeof courseFixture>>) {
    return {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: course.language,
      organizationId,
      targetLanguage: null,
    } satisfies CourseContext & { targetLanguage: null };
  }

  it("creates a published running introduction chapter at position zero", async () => {
    const course = await courseFixture({ organizationId });
    const title = "A quick guide";

    const result = await addIntroductionChapterStep({
      course: getCourseContext(course),
      plan: { description: "A friendly field guide.", title },
    });

    const dbChapter = await prisma.chapter.findUniqueOrThrow({ where: { id: result.id } });

    expect(dbChapter.courseId).toBe(course.id);
    expect(dbChapter.description).toBe("A friendly field guide.");
    expect(dbChapter.generationStatus).toBe("running");
    expect(dbChapter.isPublished).toBe(true);
    expect(dbChapter.organizationId).toBe(organizationId);
    expect(dbChapter.position).toBe(0);
    expect(dbChapter.slug).toBe("a-quick-guide");
    expect(dbChapter.title).toBe(title);

    const events = getStreamedEvents();

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "addIntroductionChapter" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "addIntroductionChapter" }),
    );
  });

  it("reuses the existing position-zero chapter on retry", async () => {
    const course = await courseFixture({ organizationId });

    const existingChapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      organizationId,
      position: 0,
      title: `Existing Intro ${randomUUID()}`,
    });

    const result = await addIntroductionChapterStep({
      course: getCourseContext(course),
      plan: { description: "New generated intro.", title: `Generated Intro ${randomUUID()}` },
    });

    const chapterCount = await prisma.chapter.count({ where: { courseId: course.id } });

    expect(result.id).toBe(existingChapter.id);
    expect(chapterCount).toBe(1);
  });

  it("throws without streaming error when DB save fails", async () => {
    const course = await courseFixture({ organizationId });
    const brokenContext = { ...getCourseContext(course), courseId: randomUUID() };

    await expect(
      addIntroductionChapterStep({
        course: brokenContext,
        plan: { description: "Broken intro.", title: `Broken Intro ${randomUUID()}` },
      }),
    ).rejects.toThrow();

    const events = getStreamedEvents();

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "addIntroductionChapter" }),
    );
  });
});
