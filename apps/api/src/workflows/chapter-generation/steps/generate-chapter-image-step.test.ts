import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateChapterImageStep } from "./generate-chapter-image-step";
import { type ChapterContext } from "./get-chapter-step";

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: vi
    .fn()
    .mockResolvedValue({ data: "https://example.com/chapter.webp", error: null }),
}));

describe(generateChapterImageStep, () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    course = await courseFixture({ organizationId });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a chapter thumbnail from the chapter title and description", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      description: "Chapter image description",
      organizationId,
      title: `Chapter Image ${randomUUID()}`,
    });

    const context: ChapterContext = {
      ...chapter,
      _count: { lessons: 0 },
      course,
      neighboringChapters: [],
    };

    const result = await generateChapterImageStep(context);

    expect(result).toBe("https://example.com/chapter.webp");

    expect(generateContentThumbnailImage).toHaveBeenCalledWith({
      description: "Chapter image description",
      kind: "chapter",
      title: chapter.title,
    });

    expect(getStreamedEvents()).toStrictEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "started", step: "generateChapterImage" }),
        expect.objectContaining({ status: "completed", step: "generateChapterImage" }),
      ]),
    );
  });

  it("returns an existing chapter image without calling AI generation", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      imageUrl: "https://example.com/existing-chapter.webp",
      organizationId,
      title: `Existing Chapter Image ${randomUUID()}`,
    });

    const context: ChapterContext = {
      ...chapter,
      _count: { lessons: 0 },
      course,
      neighboringChapters: [],
    };

    await expect(generateChapterImageStep(context)).resolves.toBe(
      "https://example.com/existing-chapter.webp",
    );

    expect(generateContentThumbnailImage).not.toHaveBeenCalled();
  });
});
