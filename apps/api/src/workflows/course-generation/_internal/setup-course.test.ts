import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type CourseContext } from "../steps/initialize-course-step";
import { type ExistingCourseContent } from "./existing-course-content";
import { setupCourse } from "./setup-course";

const {
  generateCourseDescriptionMock,
  generateCourseLandingPageMock,
  generateContentThumbnailImageMock,
  generateCourseCategoriesMock,
  generateCourseChaptersMock,
  generateCourseIntroductionMock,
  lessonGenerationWorkflowMock,
  startMock,
} = vi.hoisted(() => ({
  generateContentThumbnailImageMock: vi.fn(),
  generateCourseCategoriesMock: vi.fn(),
  generateCourseChaptersMock: vi.fn(),
  generateCourseDescriptionMock: vi.fn(),
  generateCourseIntroductionMock: vi.fn(),
  generateCourseLandingPageMock: vi.fn(),
  lessonGenerationWorkflowMock: vi.fn(),
  startMock: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({
  generateCourseDescription: generateCourseDescriptionMock,
}));

vi.mock("@zoonk/ai/tasks/courses/landing-page", () => ({
  generateCourseLandingPage: generateCourseLandingPageMock,
}));

vi.mock("@zoonk/ai/tasks/courses/introduction", () => ({
  generateCourseIntroduction: generateCourseIntroductionMock,
}));

vi.mock("@/workflows/lesson-generation/lesson-generation-workflow", () => ({
  lessonGenerationWorkflow: lessonGenerationWorkflowMock,
}));

vi.mock("workflow/api", () => ({ start: startMock }));

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: generateContentThumbnailImageMock,
}));

vi.mock("@zoonk/ai/tasks/courses/categories", () => ({
  generateCourseCategories: generateCourseCategoriesMock,
}));

vi.mock("@zoonk/ai/tasks/courses/chapters", () => ({
  generateCourseChapters: generateCourseChaptersMock,
}));

describe(setupCourse, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    lessonGenerationWorkflowMock.mockResolvedValue("ready");
    startMock.mockResolvedValue({ runId: "intro-lesson-run" });
  });

  it("generates and persists course content without completing setup", async () => {
    const course = await courseFixture({
      generationStatus: "running",
      organizationId,
      title: `Setup Course ${randomUUID()}`,
    });

    const courseContext: CourseContext = {
      courseId: course.id,
      courseSlug: course.slug,
      courseTitle: course.title,
      language: "en",
      organizationId,
      targetLanguage: null,
    };

    const existing: ExistingCourseContent = {
      chapterCount: 0,
      description: null,
      hasCategories: false,
      hasIntroductionLessons: false,
      hasMainCurriculum: false,
      imageUrl: null,
      landingPage: null,
    };

    generateCourseDescriptionMock.mockResolvedValue({ data: { description: "Setup desc" } });

    generateCourseLandingPageMock.mockResolvedValue({
      data: {
        audience: ["New learners"],
        opportunities: ["Use this in real projects"],
        outcomes: ["Build practical skill"],
        valueProposition: "A clear path into the subject.",
      },
    });

    generateContentThumbnailImageMock.mockResolvedValue({
      data: "https://example.com/setup.webp",
      error: null,
    });

    generateCourseCategoriesMock.mockResolvedValue({ data: { categories: ["testing"] } });

    generateCourseChaptersMock.mockResolvedValue({
      data: { chapters: [{ description: "Ch desc", title: `Setup Ch ${randomUUID()}` }] },
    });

    generateCourseIntroductionMock.mockResolvedValue({
      data: {
        chapter: { description: "Intro desc", title: `Setup Intro ${randomUUID()}` },
        lessons: [
          { description: "Intro lesson desc", title: `Setup Intro Lesson ${randomUUID()}` },
        ],
      },
    });

    const result = await setupCourse(courseContext, "Course request description", existing);

    expect(result.map((chapter) => chapter.position)).toStrictEqual([1]);

    const dbChapters = await prisma.chapter.findMany({
      include: { lessons: { orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
      where: { courseId: course.id },
    });

    const introLessons = dbChapters[0]?.lessons ?? [];

    expect(lessonGenerationWorkflowMock).toHaveBeenCalledWith(introLessons[0]?.id);

    expect(startMock).toHaveBeenCalledWith(lessonGenerationWorkflowMock, [introLessons[1]?.id]);
    expect(startMock).toHaveBeenCalledWith(lessonGenerationWorkflowMock, [introLessons[2]?.id]);

    expect(dbChapters.map((chapter) => chapter.position)).toStrictEqual([0, 1]);
    expect(dbChapters[0]?.generationStatus).toBe("completed");

    expect(dbChapters[0]?.lessons).toStrictEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "explanation" })]),
    );

    const updatedCourse = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });

    expect(updatedCourse.generationStatus).toBe("running");
    expect(updatedCourse.description).toBe("Setup desc");

    expect(updatedCourse.landingPage).toStrictEqual({
      audience: ["New learners"],
      opportunities: ["Use this in real projects"],
      outcomes: ["Build practical skill"],
      valueProposition: "A clear path into the subject.",
    });
  });
});
