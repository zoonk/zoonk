import { courseContext, curriculumChapters } from "@/workflows/_test-utils/curriculum";
import { type CourseLevel } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_EXISTING_CONTENT } from "./existing-course-content";
import { generateMissingContent } from "./generate-missing-content";

const { description, landing, thumbnail, categories, curriculum } = vi.hoisted(() => ({
  categories: vi.fn(),
  curriculum: vi.fn<(input: { level: CourseLevel | null }) => unknown>(),
  description: vi.fn(),
  landing: vi.fn(),
  thumbnail: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/description", () => ({ generateCourseDescription: description }));
vi.mock("@zoonk/ai/tasks/courses/landing-page", () => ({ generateCourseLandingPage: landing }));
vi.mock("@zoonk/core/content/thumbnail", () => ({ generateContentThumbnailImage: thumbnail }));
vi.mock("@zoonk/ai/tasks/courses/categories", () => ({ generateCourseCategories: categories }));

vi.mock("@zoonk/ai/tasks/courses/curriculum", () => ({
  generateCourseCurriculumLevel: curriculum,
}));

const copy = {
  audience: ["Curious learners"],
  opportunities: ["Use an idea"],
  outcomes: ["Explain an idea"],
  valueProposition: "Understand the subject",
};

describe(generateMissingContent, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    description.mockResolvedValue({ data: { description: "A useful course" } });
    landing.mockResolvedValue({ data: copy });
    thumbnail.mockResolvedValue({ data: "https://example.com/course.webp", error: null });
    categories.mockResolvedValue({ data: { categories: ["science", "languages"] } });

    curriculum.mockImplementation(({ level }) => ({
      data: { chapters: curriculumChapters(level) },
    }));
  });

  it("starts all independent level and metadata requests before waiting for any level", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const deferred = Promise.withResolvers<{
      data: { chapters: ReturnType<typeof curriculumChapters> };
    }>();

    curriculum.mockImplementation(({ level }) =>
      level === "overview" ? deferred.promise : { data: { chapters: curriculumChapters(level) } },
    );

    const result = generateMissingContent({
      course: courseContext(course),
      description: null,
      existing: EMPTY_EXISTING_CONTENT,
    });

    await vi.waitFor(() => expect(curriculum).toHaveBeenCalledTimes(4));
    expect(description).toHaveBeenCalledOnce();
    expect(thumbnail).toHaveBeenCalledOnce();
    expect(categories).toHaveBeenCalledOnce();
    expect(landing).not.toHaveBeenCalled();
    deferred.resolve({ data: { chapters: curriculumChapters("overview") } });

    await expect(result).resolves.toMatchObject({
      categories: ["science"],
      chapters: expect.any(Array),
      description: "A useful course",
      landingPage: copy,
    });

    expect(landing).toHaveBeenCalledOnce();
  });

  it("reuses all saved content without model work", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const existing = {
      ...EMPTY_EXISTING_CONTENT,
      chapterCount: 6,
      description: "Saved summary",
      hasCategories: true,
      hasMainCurriculum: true,
      imageUrl: "https://example.com/saved.webp",
      landingPage: copy,
    };

    await expect(
      generateMissingContent({ course: courseContext(course), description: null, existing }),
    ).resolves.toMatchObject({
      chapters: [],
      description: "Saved summary",
      imageUrl: existing.imageUrl,
    });

    for (const task of [description, landing, thumbnail, categories, curriculum]) {
      expect(task).not.toHaveBeenCalled();
    }
  });

  it("requests all six CEFR levels and uses the known language category without landing-page AI", async () => {
    const organization = await aiOrganizationFixture();

    const course = await courseFixture({
      format: "language",
      organizationId: organization.id,
      targetLanguage: "pl",
    });

    const result = await generateMissingContent({
      course: courseContext(course),
      description: null,
      existing: EMPTY_EXISTING_CONTENT,
    });

    expect(curriculum.mock.calls.map(([input]) => input.level)).toStrictEqual([
      "a1",
      "a2",
      "b1",
      "b2",
      "c1",
      "c2",
    ]);

    expect(result.categories).toStrictEqual(["languages"]);
    expect(result.landingPage).toBeNull();
    expect(landing).not.toHaveBeenCalled();
    expect(categories).not.toHaveBeenCalled();
  });
});
