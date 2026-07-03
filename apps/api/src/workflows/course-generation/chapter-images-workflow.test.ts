import { randomUUID } from "node:crypto";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { chapterImagesWorkflow } from "./chapter-images-workflow";

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: vi.fn(({ title }: { title: string }) =>
    Promise.resolve({
      data: `https://example.com/chapter/${encodeURIComponent(title)}.webp`,
      error: null,
    }),
  ),
}));

describe(chapterImagesWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
  });

  it("loads missing chapter images from the course and runs them independently", async () => {
    const course = await courseFixture({ organizationId });
    const existingImageUrl = "https://example.com/chapter/existing.webp";

    const [successfulChapter, failedChapter, existingImageChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        organizationId,
        position: 0,
        title: `Successful Image Chapter ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: course.id,
        organizationId,
        position: 1,
        title: `Failed Image Chapter ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: course.id,
        imageUrl: existingImageUrl,
        organizationId,
        position: 2,
        title: `Existing Image Chapter ${randomUUID()}`,
      }),
    ]);

    vi.mocked(generateContentThumbnailImage).mockImplementation(({ kind, title }) => {
      if (title === failedChapter.title) {
        return Promise.resolve({ data: null, error: new Error("Image generation failed") });
      }

      return Promise.resolve({
        data: `https://example.com/${kind}/${encodeURIComponent(title)}.webp`,
        error: null,
      });
    });

    await expect(chapterImagesWorkflow(course.id)).resolves.toBeUndefined();

    const [updatedSuccessfulChapter, updatedFailedChapter, updatedExistingImageChapter] =
      await Promise.all([
        prisma.chapter.findUnique({ where: { id: successfulChapter.id } }),
        prisma.chapter.findUnique({ where: { id: failedChapter.id } }),
        prisma.chapter.findUnique({ where: { id: existingImageChapter.id } }),
      ]);

    expect(updatedSuccessfulChapter?.imageUrl).toBe(
      `https://example.com/chapter/${encodeURIComponent(successfulChapter.title)}.webp`,
    );

    expect(updatedFailedChapter?.imageUrl).toBeNull();
    expect(updatedExistingImageChapter?.imageUrl).toBe(existingImageUrl);

    expect(generateContentThumbnailImage).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: existingImageChapter.title }),
    );
  });
});
