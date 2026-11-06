import { randomUUID } from "node:crypto";
import { checkLessonImage } from "@zoonk/ai/tasks/images/check";
import { describeImageScene } from "@zoonk/ai/tasks/images/scene-schema";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { pictureCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { buildImageReuseKey } from "@zoonk/utils/identity-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { serveStoredFile, storeBlobUploads } from "../../_test-utils/blob-uploads";
import { mockSearchTerms } from "../identity/_test-utils/identity-mocks";
import {
  drawBlankImage,
  drawTestImage,
  mockDrawnImages,
  mockImageChecks,
  mockImageScene,
  testScene,
} from "./_test-utils/image-mocks";
import {
  type PictureRedraw,
  checkImageAsset,
  listOwedPictureChecks,
  owesPictureCheck,
  planImageAssetAgain,
  recordFailedPictureCheck,
  redrawImageAsset,
  removeImageAsset,
  replaceImageAsset,
} from "./check-image-asset";
import { createStepImage } from "./lesson-images";

const alt = "Mão com um pequeno corte na pele e micróbios entrando pelo corte.";

const DAY_MS = 86_400_000;

async function owedCheckOf(assetId: string) {
  const { checkOwedAt } = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: assetId } });
  return checkOwedAt;
}

async function shownPicture() {
  const [asset, lesson, skill] = await Promise.all([
    mediaAssetFixture({
      alt,
      checkOwedAt: new Date(),
      scene: testScene({ focalObject: `a ${randomUUID()} map` }),
    }),
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

function redrawOf(scene = testScene({ focalObject: `a ${randomUUID()} hand` })): PictureRedraw {
  return {
    height: 32,
    provenance: {
      generatedAt: "2026-11-04T12:00:00.000Z",
      model: "openai/gpt-image-2.5-flare",
      promptVersion: "style-v1-test",
      runId: "redraw-run",
    },
    reuseKey: `image:replanned:${randomUUID()}`,
    scene,
    url: `https://blob.test/${randomUUID()}-step.webp`,
    width: 48,
  };
}

describe(checkImageAsset, () => {
  let readStoredFile: ReturnType<typeof serveStoredFile>;

  beforeEach(async () => {
    vi.resetAllMocks();

    readStoredFile = serveStoredFile({
      data: new Uint8Array(await drawTestImage()),
      mediaType: "image/webp",
    });
  });

  it("passes a shown picture its check accepts against the alt it was drawn for, checking it at flex, so it no longer owes its check", async () => {
    const { asset } = await shownPicture();
    mockImageChecks([true]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      status: "passed",
    });

    expect(readStoredFile).toHaveBeenCalledWith(asset.url);

    expect(checkLessonImage).toHaveBeenCalledWith(
      expect.objectContaining({ alt, serviceTier: "flex" }),
    );

    await expect(owedCheckOf(asset.id)).resolves.toBeNull();
  });

  it("returns what the check found, and the picture still owes its check until a redraw replaces it", async () => {
    const { asset } = await shownPicture();
    mockImageChecks([false]);

    await expect(checkImageAsset({ assetId: asset.id })).resolves.toStrictEqual({
      findings: ["shows a different object"],
      status: "rejected",
    });

    await expect(owedCheckOf(asset.id)).resolves.toStrictEqual(asset.checkOwedAt);
  });

  it("checks a redraw's own file against its own scene, leaving the picture owed until the redraw replaces it", async () => {
    const { asset } = await shownPicture();
    const redraw = redrawOf();
    mockImageChecks([true]);

    await expect(checkImageAsset({ assetId: asset.id, redraw })).resolves.toStrictEqual({
      status: "passed",
    });

    expect(readStoredFile).toHaveBeenCalledExactlyOnceWith(redraw.url);

    expect(checkLessonImage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ alt, scene: redraw.scene }),
    );

    await expect(owedCheckOf(asset.id)).resolves.toStrictEqual(asset.checkOwedAt);
  });

  it("does nothing for a picture that's gone", async () => {
    await expect(checkImageAsset({ assetId: randomUUID() })).resolves.toStrictEqual({
      status: "missing",
    });

    expect(checkLessonImage).not.toHaveBeenCalled();
  });
});

describe(planImageAssetAgain, () => {
  it("plans the scene again from the alt it was drawn for and the check's findings, keeping its labels", async () => {
    vi.resetAllMocks();
    const labels = [{ target: "the cut", text: "corte" }];

    const asset = await mediaAssetFixture({
      alt,
      language: "pt",
      scene: testScene({ focalObject: `a ${randomUUID()} skin section`, labels }),
    });

    const replanned = testScene({ focalObject: `a ${randomUUID()} hand with a small cut` });
    const sceneSpy = mockImageScene(replanned);
    const findings = ["shows a skin section with no hand"];

    await expect(planImageAssetAgain({ assetId: asset.id, findings })).resolves.toStrictEqual({
      ...replanned,
      labels,
    });

    expect(sceneSpy).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ alt, findings, language: "pt", request: alt, textAllowed: true }),
    );
  });
});

describe(redrawImageAsset, () => {
  beforeEach(() => {
    vi.resetAllMocks();
    storeBlobUploads();
  });

  it("draws a square option picture square with the check's findings, storing it apart from the picture", async () => {
    const asset = await mediaAssetFixture({ height: 1024, scene: testScene(), width: 1024 });
    const scene = testScene({ focalObject: `a ${randomUUID()} doorway` });
    const findings = ["shows a window, not a doorway"];
    const drawSpy = mockDrawnImages([await drawTestImage()]);

    const redraw = await redrawImageAsset({ assetId: asset.id, findings, scene });

    expect(redraw).toMatchObject({ scene, url: expect.stringContaining("https://blob.test/") });
    expect(redraw.url).not.toBe(asset.url);

    expect(drawSpy).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ canvas: "square", corrections: findings, scene }),
    );

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).resolves.toMatchObject({ url: asset.url });
  });

  it("throws on a blank frame after one draw, so its step draws again", async () => {
    const asset = await mediaAssetFixture({ scene: testScene() });
    const drawSpy = mockDrawnImages([await drawBlankImage()]);

    await expect(
      redrawImageAsset({ assetId: asset.id, findings: ["blurry"], scene: testScene() }),
    ).rejects.toThrow("blank frame");

    expect(drawSpy).toHaveBeenCalledOnce();
  });
});

describe(replaceImageAsset, () => {
  it("shows the redraw wherever the picture is shown", async () => {
    const { asset, item, step } = await shownPicture();
    const redraw = redrawOf();

    await replaceImageAsset({ assetId: asset.id, redraw });

    const [stored, screen, question] = await Promise.all([
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
      prisma.item.findUniqueOrThrow({ where: { id: item.id } }),
    ]);

    expect(stored).toMatchObject({
      checkOwedAt: null,
      runId: "redraw-run",
      scene: redraw.scene,
      url: redraw.url,
    });

    expect(screen.mediaAssetId).toBe(asset.id);
    expect(screen.pictureAvailableAt).toStrictEqual(step.pictureAvailableAt);
    expect(screen.updatedAt.getTime()).toBeGreaterThan(step.updatedAt.getTime());
    expect(question.mediaAssetId).toBe(asset.id);
  });

  it("no longer answers a request for the scene it was planned away from", async () => {
    vi.resetAllMocks();
    storeBlobUploads();
    const original = testScene({ focalObject: `a ${randomUUID()} skin section` });
    const prompt = describeImageScene(original);

    const [asset, lesson] = await Promise.all([
      mediaAssetFixture({
        prompt,
        reuseKey: buildImageReuseKey({ canvas: "landscape", language: null, prompt }),
        scene: original,
      }),
      libraryLessonFixture(),
    ]);

    mockDrawnImages([await drawTestImage(), await drawTestImage()]);

    const redraw = await redrawImageAsset({
      assetId: asset.id,
      findings: ["no hand"],
      scene: testScene({ focalObject: `a ${randomUUID()} hand with a small cut` }),
    });

    await replaceImageAsset({ assetId: asset.id, redraw });

    const step = await libraryStepFixture({
      content: { image: { alt, prompt: "A skin section" }, text: "Skin keeps germs out." },
      lessonId: lesson.id,
    });

    mockImageScene(original);
    mockSearchTerms([]);

    await expect(createStepImage({ stepId: step.id })).resolves.toMatchObject({
      status: "generated",
    });
  });
});

describe(owesPictureCheck, () => {
  it("owes a stored picture's check until it failed three times", async () => {
    const asset = await mediaAssetFixture({ checkFailures: 1, checkOwedAt: new Date() });

    await expect(owesPictureCheck(asset.id)).resolves.toBe(true);
    await recordFailedPictureCheck(asset.id);
    await expect(owesPictureCheck(asset.id)).resolves.toBe(true);
    await recordFailedPictureCheck(asset.id);
    await expect(owesPictureCheck(asset.id)).resolves.toBe(false);
  });

  it("owes nothing for a picture that was checked or is gone", async () => {
    const asset = await mediaAssetFixture({ checkOwedAt: null });

    await expect(owesPictureCheck(asset.id)).resolves.toBe(false);
    await expect(owesPictureCheck(randomUUID())).resolves.toBe(false);
  });
});

describe(listOwedPictureChecks, () => {
  it("lists the pictures still owing a check, longest-owed first, leaving checked ones and those whose checks kept failing", async () => {
    const now = Date.now();

    const [older, newer, checked, failing] = await Promise.all([
      mediaAssetFixture({ checkOwedAt: new Date(now - 30 * DAY_MS) }),
      mediaAssetFixture({ checkFailures: 2, checkOwedAt: new Date(now - 29 * DAY_MS) }),
      mediaAssetFixture({ checkOwedAt: null }),
      mediaAssetFixture({ checkFailures: 3, checkOwedAt: new Date(now - 31 * DAY_MS) }),
    ]);

    const listed = await listOwedPictureChecks();

    expect(listed.filter((id) => id === older.id || id === newer.id)).toStrictEqual([
      older.id,
      newer.id,
    ]);

    expect(listed).not.toContain(checked.id);
    expect(listed).not.toContain(failing.id);
  });
});

describe(removeImageAsset, () => {
  it("takes a picture out of use, dropping the questions about it", async () => {
    const { asset, item, step } = await shownPicture();

    await removeImageAsset({ assetId: asset.id });

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

  it("takes an option's picture out of its question, and does nothing once it's gone", async () => {
    const [asset, lesson] = await Promise.all([mediaAssetFixture(), libraryLessonFixture()]);

    const step = await libraryStepFixture({
      content: pictureCheckContent,
      kind: "check",
      lessonId: lesson.id,
    });

    await prisma.stepOptionPicture.create({
      data: { mediaAssetId: asset.id, optionId: "gothic", stepId: step.id },
    });

    await removeImageAsset({ assetId: asset.id });
    await removeImageAsset({ assetId: asset.id });

    const [option, screen] = await Promise.all([
      prisma.stepOptionPicture.findUnique({
        where: { stepId_optionId: { optionId: "gothic", stepId: step.id } },
      }),
      prisma.step.findUniqueOrThrow({ where: { id: step.id } }),
    ]);

    expect(option).toBeNull();
    expect(screen.updatedAt.getTime()).toBeGreaterThan(step.updatedAt.getTime());
  });
});
