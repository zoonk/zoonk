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
  let course: Awaited<ReturnType<typeof courseFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId });
  });

  it("runs chapter image steps independently so one failure does not block the rest", async () => {
    const [successfulChapter, failedChapter] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        organizationId,
        title: `Successful Image Chapter ${randomUUID()}`,
      }),
      chapterFixture({
        courseId: course.id,
        organizationId,
        title: `Failed Image Chapter ${randomUUID()}`,
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

    await expect(
      chapterImagesWorkflow([successfulChapter, failedChapter]),
    ).resolves.toBeUndefined();

    const [updatedSuccessfulChapter, updatedFailedChapter] = await Promise.all([
      prisma.chapter.findUnique({ where: { id: successfulChapter.id } }),
      prisma.chapter.findUnique({ where: { id: failedChapter.id } }),
    ]);

    expect(updatedSuccessfulChapter?.imageUrl).toBe(
      `https://example.com/chapter/${encodeURIComponent(successfulChapter.title)}.webp`,
    );

    expect(updatedFailedChapter?.imageUrl).toBeNull();
  });
});
