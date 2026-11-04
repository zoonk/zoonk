import { randomUUID } from "node:crypto";
import { checkLessonImage } from "@zoonk/ai/tasks/images/check";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { pictureCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serveStoredFile, storeBlobUploads } from "../../_test-utils/blob-uploads";
import {
  drawTestImage,
  mockDrawnImages,
  mockImageChecks,
  mockImageScene,
  mockImageScenes,
  testScene,
} from "./_test-utils/image-mocks";
import { checkImageAsset } from "./check-image-asset";

async function shownPicture() {
  const [asset, lesson, skill] = await Promise.all([
    mediaAssetFixture({ scene: testScene({ focalObject: `a ${randomUUID()} map` }) }),
    libraryLessonFixture(),
    skillFixture(),
  ]);

  const [step, item] = await Promise.all([
    libraryStepFixture({
      lessonId: lesson.id,
      mediaAssetId: asset.id,
      pictureAvailableAt: new Date("2020-01-01T00:00:00Z"),
      position: 0,
    }),
    itemFixture({ mediaAssetId: asset.id, skillId: skill.id }),
  ]);

  return { asset, item, step };
}

describe(checkImageAsset, () => {
  let readStoredFile: ReturnType<typeof serveStoredFile>;

  beforeEach(async () => {
    vi.resetAllMocks();

    readStoredFile = serveStoredFile({
      data: new Uint8Array(await drawTestImage()),
      mediaType: "image/webp",
    });

    storeBlobUploads();
  });

  it("leaves a shown picture that passes its check as it is, checking it at flex", async () => {
    const { asset } = await shownPicture();
    mockImageChecks([true]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      status: "passed",
    });

    expect(readStoredFile).toHaveBeenCalledWith(asset.url);
    expect(checkLessonImage).toHaveBeenCalledWith(expect.objectContaining({ serviceTier: "flex" }));

    await expect(prisma.mediaAsset.findUnique({ where: { id: asset.id } })).resolves.toMatchObject({
      url: asset.url,
    });
  });

  it("replaces a picture its check rejects with a redraw that passes, wherever it's shown", async () => {
    const { asset, item, step } = await shownPicture();
    mockImageChecks([false, true]);
    mockImageScene(testScene());
    const drawSpy = mockDrawnImages([await drawTestImage()]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      status: "replaced",
    });

    expect(drawSpy).toHaveBeenCalledWith(
      expect.objectContaining({ canvas: "landscape", corrections: ["shows a different object"] }),
    );

    const [stored, screen, question] = await Promise.all([
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
      prisma.item.findUniqueOrThrow({ where: { id: item.id } }),
    ]);

    expect(stored.url).not.toBe(asset.url);
    expect(screen.mediaAssetId).toBe(asset.id);
    expect(screen.pictureAvailableAt).toStrictEqual(step.pictureAvailableAt);
    expect(question.mediaAssetId).toBe(asset.id);
    expect(screen.updatedAt.getTime()).toBeGreaterThan(step.updatedAt.getTime());
  });

  it("plans a rejected picture's scene again from its alt and the check's findings, and draws that", async () => {
    const { asset } = await shownPicture();
    const alt = "Mão com um pequeno corte na pele e micróbios entrando pelo corte.";
    const replanned = testScene({ focalObject: `a ${randomUUID()} hand with a small cut` });
    mockImageChecks([false, true]);
    const sceneSpy = mockImageScene(replanned);
    const drawSpy = mockDrawnImages([await drawTestImage()]);

    await expect(checkImageAsset({ alt, assetId: asset.id })).resolves.toStrictEqual({
      status: "replaced",
    });

    expect(sceneSpy).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ alt, findings: ["shows a different object"] }),
    );

    expect(drawSpy).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ scene: replanned }));

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).resolves.toMatchObject({ scene: replanned });
  });

  it("keeps a scene's picture when its redraw fails too, drawing its person and place instead", async () => {
    const [asset, lesson] = await Promise.all([
      mediaAssetFixture({ scene: testScene({ focalObject: `a ${randomUUID()} skin section` }) }),
      libraryLessonFixture(),
    ]);

    const alt = "Mão com um pequeno corte na pele e micróbios entrando pelo corte.";

    const scene = await libraryStepFixture({
      content: {
        image: { alt, prompt: "A hand with a small cut" },
        text: "Fábio corta a mão.",
        variant: "text",
      },
      kind: "hook",
      lessonId: lesson.id,
      mediaAssetId: asset.id,
    });

    const setting = testScene({ focalObject: `a ${randomUUID()} man in his kitchen` });
    mockImageChecks([false, false, false]);
    const sceneSpy = mockImageScenes([testScene({ focalObject: "a hand with a cut" }), setting]);
    const drawSpy = mockDrawnImages([await drawTestImage(), await drawTestImage()]);

    await expect(checkImageAsset({ alt, assetId: asset.id })).resolves.toStrictEqual({
      status: "replaced",
    });

    expect(drawSpy).toHaveBeenCalledTimes(2);
    expect(checkLessonImage).toHaveBeenCalledTimes(2);

    expect(sceneSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ alt: null, textAllowed: false }),
    );

    const [stored, screen] = await Promise.all([
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: scene.id } }),
    ]);

    expect(stored).toMatchObject({ scene: setting });
    expect(stored.url).not.toBe(asset.url);
    expect(screen.mediaAssetId).toBe(asset.id);
  });

  it("takes a picture out of use when its redraws fail too, dropping the questions about it", async () => {
    const { asset, item, step } = await shownPicture();
    mockImageChecks([false, false, false]);
    mockImageScene(testScene());
    mockDrawnImages([await drawTestImage(), await drawTestImage()]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      status: "removed",
    });

    const [stored, screen, question] = await Promise.all([
      prisma.mediaAsset.findUnique({ where: { id: asset.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
      prisma.item.findUnique({ where: { id: item.id } }),
    ]);

    expect(stored).toBeNull();
    expect(screen.mediaAssetId).toBeNull();
    expect(screen.pictureAvailableAt).toBeNull();
    expect(question).toBeNull();
  });

  it("redraws an option's square picture square and takes it out of use when the redraws fail", async () => {
    const [asset, lesson] = await Promise.all([
      mediaAssetFixture({
        height: 1024,
        scene: testScene({ focalObject: `a ${randomUUID()} doorway` }),
        width: 1024,
      }),
      libraryLessonFixture(),
    ]);

    const step = await libraryStepFixture({
      content: pictureCheckContent,
      kind: "check",
      lessonId: lesson.id,
    });

    await prisma.stepOptionPicture.create({
      data: { mediaAssetId: asset.id, optionId: "gothic", stepId: step.id },
    });

    mockImageChecks([false, false, false]);
    mockImageScene(testScene());
    const drawSpy = mockDrawnImages([await drawTestImage(), await drawTestImage()]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      status: "removed",
    });

    expect(drawSpy).toHaveBeenCalledTimes(2);
    expect(drawSpy).toHaveBeenCalledWith(expect.objectContaining({ canvas: "square" }));

    const [option, screen] = await Promise.all([
      prisma.stepOptionPicture.findUnique({
        where: { stepId_optionId: { optionId: "gothic", stepId: step.id } },
      }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
    ]);

    expect(option).toBeNull();
    expect(screen.updatedAt.getTime()).toBeGreaterThan(step.updatedAt.getTime());
  });

  it("does nothing for a picture that's gone", async () => {
    await expect(checkImageAsset({ assetId: randomUUID() })).resolves.toStrictEqual({
      status: "missing",
    });

    expect(checkLessonImage).not.toHaveBeenCalled();
  });
});
