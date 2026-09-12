import { courseContext, curriculumChapters } from "@/workflows/_test-utils/curriculum";
import { type CourseLevel, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_EXISTING_CONTENT } from "./existing-course-content";
import { setupCourse } from "./setup-course";

const { description, landing, thumbnail, categories, curriculum, start } = vi.hoisted(() => ({
  categories: vi.fn(),
  curriculum: vi.fn<(input: { level: CourseLevel | null }) => unknown>(),
  description: vi.fn(),
  landing: vi.fn(),
  start: vi.fn(),
  thumbnail: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({ generateCourseDescription: description }));
vi.mock("@zoonk/ai/tasks/courses/landing-page", () => ({ generateCourseLandingPage: landing }));
vi.mock("@zoonk/core/content/thumbnail", () => ({ generateContentThumbnailImage: thumbnail }));
vi.mock("@zoonk/ai/tasks/courses/categories", () => ({ generateCourseCategories: categories }));

vi.mock("@zoonk/ai/tasks/courses/curriculum", () => ({
  generateCourseCurriculumLevel: curriculum,
}));

vi.mock("workflow/api", () => ({ start }));

describe(setupCourse, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    description.mockResolvedValue({ data: { description: "A useful course" } });

    landing.mockResolvedValue({
      data: {
        audience: ["Curious learners"],
        opportunities: ["Use an idea"],
        outcomes: ["Explain a useful idea"],
        valueProposition: "Understand the subject",
      },
    });

    thumbnail.mockResolvedValue({ data: "https://example.com/course.webp", error: null });
    categories.mockResolvedValue({ data: { categories: ["science"] } });

    curriculum.mockImplementation(({ level }) => ({
      data: { chapters: curriculumChapters(level) },
    }));
  });

  it("persists metadata and every core level without spending on any lesson or chapter generation", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      generationRunId: "setup-run",
      generationStatus: "running",
      organizationId: organization.id,
    });

    const result = await setupCourse(courseContext(course), null, EMPTY_EXISTING_CONTENT);
    expect(result).toHaveLength(6);

    expect(curriculum.mock.calls.map(([input]) => input.level)).toStrictEqual([
      "overview",
      "basic",
      "intermediate",
      "advanced",
    ]);

    await expect(
      prisma.lesson.count({ where: { chapter: { courseId: course.id } } }),
    ).resolves.toBe(0);

    expect(start).not.toHaveBeenCalled();
    const saved = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(saved.description).toBe("A useful course");
    expect(saved.imageUrl).toBe("https://example.com/course.webp");
    expect(saved.generationStatus).toBe("running");
  });

  it("does not install a partial curriculum when one level fails", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    curriculum.mockImplementation(({ level }) =>
      level === "advanced"
        ? Promise.reject(new Error("level unavailable"))
        : { data: { chapters: curriculumChapters(level) } },
    );

    await expect(setupCourse(courseContext(course), null, EMPTY_EXISTING_CONTENT)).rejects.toThrow(
      "level unavailable",
    );

    await expect(prisma.chapter.count({ where: { courseId: course.id } })).resolves.toBe(0);
    expect(start).not.toHaveBeenCalled();
  });
});
