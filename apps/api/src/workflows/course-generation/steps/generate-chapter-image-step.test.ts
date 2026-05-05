import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { generateChapterImageStep } from "./generate-chapter-image-step";

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: vi.fn(({ title }: { title: string }) =>
    Promise.resolve({
      data: `https://example.com/chapter/${encodeURIComponent(title)}.webp`,
      error: null,
    }),
  ),
}));

describe(generateChapterImageStep, () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
  });

  it("generates a missing chapter image without streaming progress", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Chapter Image ${randomUUID()}`,
    });

    await generateChapterImageStep(chapter);

    const updatedChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });

    expect(updatedChapter?.imageUrl).toBe(
      `https://example.com/chapter/${encodeURIComponent(chapter.title)}.webp`,
    );

    expect(generateContentThumbnailImage).toHaveBeenCalledWith({
      description: chapter.description,
      kind: "chapter",
      title: chapter.title,
    });

    expect(getStreamedEvents()).toStrictEqual([]);
  });

  it("skips chapters that already have an image", async () => {
    const chapter = await chapterFixture({
      courseId: course.id,
      imageUrl: "https://example.com/chapter/existing.webp",
      organizationId,
      title: `Existing Image Chapter ${randomUUID()}`,
    });

    await generateChapterImageStep(chapter);

    const updatedChapter = await prisma.chapter.findUnique({ where: { id: chapter.id } });

    expect(updatedChapter?.imageUrl).toBe(chapter.imageUrl);
    expect(generateContentThumbnailImage).not.toHaveBeenCalled();
  });
});
