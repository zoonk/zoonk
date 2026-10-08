import { randomUUID } from "node:crypto";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStoredImage } from "../../images/read-stored-image";
import { uploadImage } from "../../images/upload-image";
import {
  drawTestImage,
  mockDrawnImages,
  mockImageChecks,
  testScene,
} from "./_test-utils/image-mocks";
import { checkImageAsset } from "./check-image-asset";

/** Vercel Blob is an external service: the stored file is read back and written through it. */
vi.mock("../../images/read-stored-image", () => ({ readStoredImage: vi.fn() }));
vi.mock("../../images/upload-image", () => ({ uploadImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/check", () => ({ checkLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/generate", () => ({ generateLessonImage: vi.fn() }));

/** A picture already shown on a lesson screen and on a question about it, not checked yet. */
async function shownPicture() {
  const [asset, lesson, skill] = await Promise.all([
    mediaAssetFixture({ scene: testScene({ focalObject: `a ${randomUUID()} map` }) }),
    libraryLessonFixture(),
    skillFixture(),
  ]);

  const [step, item] = await Promise.all([
    libraryStepFixture({ lessonId: lesson.id, mediaAssetId: asset.id, position: 0 }),
    itemFixture({ mediaAssetId: asset.id, skillId: skill.id }),
  ]);

  return { asset, item, step };
}

describe(checkImageAsset, () => {
  beforeEach(async () => {
    vi.resetAllMocks();

    vi.mocked(readStoredImage).mockResolvedValue({
      data: new Uint8Array(await drawTestImage()),
      mediaType: "image/webp",
    });

    vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
      Promise.resolve({ data: `https://blob.test/${fileName}-${randomUUID()}`, error: null }),
    );
  });

  it("leaves a shown picture that passes its check as it is, checking it at flex", async () => {
    const { asset } = await shownPicture();
    mockImageChecks([true]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      status: "passed",
    });

    expect(readStoredImage).toHaveBeenCalledWith({ url: asset.url });
    expect(checkLessonImage).toHaveBeenCalledWith(expect.objectContaining({ serviceTier: "flex" }));

    await expect(prisma.mediaAsset.findUnique({ where: { id: asset.id } })).resolves.toMatchObject({
      url: asset.url,
    });
  });

  it("replaces a picture its check rejects with a redraw that passes, wherever it's shown", async () => {
    const { asset, item, step } = await shownPicture();
    mockImageChecks([false, true]);
    const drawSpy = mockDrawnImages([await drawTestImage()]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      status: "replaced",
    });

    // The redraw is told what the check found wrong.
    expect(drawSpy).toHaveBeenCalledWith(
      expect.objectContaining({ corrections: ["shows a different object"] }),
    );

    const [stored, screen, question] = await Promise.all([
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
      prisma.item.findUniqueOrThrow({ where: { id: item.id } }),
    ]);

    // Same asset, new file: the screen and the question show the redraw from now on, and their
    // rows changed, so cached lessons read them again.
    expect(stored.url).not.toBe(asset.url);
    expect(screen.mediaAssetId).toBe(asset.id);
    expect(question.mediaAssetId).toBe(asset.id);
    expect(screen.updatedAt.getTime()).toBeGreaterThan(step.updatedAt.getTime());
  });

  it("takes a picture out of use when its redraws fail too, dropping the questions about it", async () => {
    const { asset, item, step } = await shownPicture();
    mockImageChecks([false, false, false]);
    mockDrawnImages([await drawTestImage(), await drawTestImage()]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      status: "removed",
    });

    const [stored, screen, question] = await Promise.all([
      prisma.mediaAsset.findUnique({ where: { id: asset.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
      prisma.item.findUnique({ where: { id: item.id } }),
    ]);

    // The screen shows its description instead; a question never goes without its picture.
    expect(stored).toBeNull();
    expect(screen.mediaAssetId).toBeNull();
    expect(question).toBeNull();
  });

  it("does nothing for a picture that's gone", async () => {
    await expect(checkImageAsset({ assetId: randomUUID() })).resolves.toStrictEqual({
      status: "missing",
    });

    expect(checkLessonImage).not.toHaveBeenCalled();
  });
});
