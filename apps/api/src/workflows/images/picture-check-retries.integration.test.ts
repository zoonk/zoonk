import { randomUUID } from "node:crypto";
import { checkLessonImage } from "@zoonk/ai/tasks/images/check";
import { generateLessonImage } from "@zoonk/ai/tasks/images/generate";
import { generateImageScene } from "@zoonk/ai/tasks/images/scene";
import { uploadImage } from "@zoonk/core/images/upload";
import { prisma } from "@zoonk/db";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import {
  BLANK_IMAGE,
  TEST_IMAGE,
  imageProvenance,
  passedCheck,
  sceneFor,
} from "./_test-utils/image-results";
import { pictureChecksWorkflow } from "./picture-checks-workflow";

vi.mock("@zoonk/ai/tasks/images/check", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkLessonImage: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/images/generate", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateLessonImage: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/images/scene", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateImageScene: vi.fn(),
}));

vi.mock("@zoonk/core/images/upload", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  uploadImage: vi.fn(),
}));

const STORED = "https://blob.test/";

function serveStoredPictures() {
  const fetchOther = globalThis.fetch;

  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    (input instanceof Request ? input.url : input.toString()).startsWith(STORED)
      ? Promise.resolve(new Response(TEST_IMAGE, { headers: { "content-type": "image/webp" } }))
      : fetchOther(input, init),
  );
}

describe("picture check durability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries only the redraw when storing it fails, never checking or planning the picture again", async () => {
    const original = sceneFor(`a skin section ${randomUUID()}`);
    const replanned = sceneFor(`a hand with a small cut ${randomUUID()}`);

    const asset = await mediaAssetFixture({
      checkOwedAt: new Date(),
      scene: original,
      url: `${STORED}${randomUUID()}.webp`,
    });

    serveStoredPictures();

    vi.mocked(checkLessonImage).mockImplementation(async ({ scene }) =>
      scene.focalObject === original.focalObject
        ? ({ data: { ...passedCheck.data, passed: false, problems: ["no hand"] } } as never)
        : (passedCheck as never),
    );

    vi.mocked(generateImageScene).mockResolvedValue({ data: replanned } as never);

    vi.mocked(generateLessonImage).mockResolvedValue({
      data: { image: { mediaType: "image/webp", uint8Array: TEST_IMAGE } },
      prompt: "test prompt",
      provenance: imageProvenance,
    } as never);

    const storedUrl = `${STORED}${randomUUID()}-redraw.webp`;

    vi.mocked(uploadImage)
      .mockResolvedValueOnce({ data: null, error: new Error("Blob store unavailable") } as never)
      .mockResolvedValue({ data: storedUrl, error: null });

    const run = await start(pictureChecksWorkflow, [{ assetIds: [asset.id] }]);

    await expect(run.returnValue).resolves.toStrictEqual({ passed: 0, removed: 0, replaced: 1 });

    expect(checkLessonImage).toHaveBeenCalledTimes(2);
    expect(generateImageScene).toHaveBeenCalledOnce();
    expect(generateLessonImage).toHaveBeenCalledTimes(2);

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).resolves.toMatchObject({ checkOwedAt: null, scene: replanned, url: storedUrl });
  });

  it("takes a rejected picture out of use once every redraw is a blank frame", async () => {
    const asset = await mediaAssetFixture({
      checkOwedAt: new Date(),
      scene: sceneFor(`a skin section ${randomUUID()}`),
      url: `${STORED}${randomUUID()}.webp`,
    });

    serveStoredPictures();

    vi.mocked(checkLessonImage).mockResolvedValue({
      data: { ...passedCheck.data, passed: false, problems: ["no hand"] },
    } as never);

    vi.mocked(generateImageScene).mockResolvedValue({
      data: sceneFor(`a hand with a small cut ${randomUUID()}`),
    } as never);

    vi.mocked(generateLessonImage).mockResolvedValue({
      data: { image: { mediaType: "image/webp", uint8Array: BLANK_IMAGE } },
      prompt: "test prompt",
      provenance: imageProvenance,
    } as never);

    const run = await start(pictureChecksWorkflow, [{ assetIds: [asset.id] }]);

    await expect(run.returnValue).resolves.toStrictEqual({ passed: 0, removed: 1, replaced: 0 });
    expect(generateLessonImage).toHaveBeenCalledTimes(4);
    await expect(prisma.mediaAsset.findUnique({ where: { id: asset.id } })).resolves.toBeNull();
  });

  it("checks a picture once when a second run starts checking it while the first still is", async () => {
    const asset = await mediaAssetFixture({
      checkOwedAt: new Date(),
      scene: sceneFor(`a skin section ${randomUUID()}`),
      url: `${STORED}${randomUUID()}.webp`,
    });

    serveStoredPictures();
    const checking = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    vi.mocked(checkLessonImage).mockImplementation(async () => {
      checking.resolve(null);
      await release.promise;
      return passedCheck as never;
    });

    const first = await start(pictureChecksWorkflow, [{ assetIds: [asset.id] }]);
    await checking.promise;
    const second = await start(pictureChecksWorkflow, [{ assetIds: [asset.id] }]);

    await expect(second.returnValue).resolves.toStrictEqual({ passed: 0, removed: 0, replaced: 0 });
    release.resolve(null);
    await expect(first.returnValue).resolves.toStrictEqual({ passed: 1, removed: 0, replaced: 0 });
    expect(checkLessonImage).toHaveBeenCalledOnce();
  });

  it("records a check that failed after its retries and checks the picture again in a later run", async () => {
    const asset = await mediaAssetFixture({
      checkOwedAt: new Date(),
      scene: sceneFor(`a skin section ${randomUUID()}`),
      url: `${STORED}${randomUUID()}.webp`,
    });

    serveStoredPictures();
    vi.mocked(checkLessonImage).mockRejectedValue(new Error("Gateway unavailable"));

    const failed = await start(pictureChecksWorkflow, [{ assetIds: [asset.id] }]);
    await expect(failed.returnValue).resolves.toStrictEqual({ passed: 0, removed: 0, replaced: 0 });

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).resolves.toMatchObject({ checkFailures: 1, checkOwedAt: expect.any(Date) });

    vi.mocked(checkLessonImage).mockResolvedValue(passedCheck as never);
    const later = await start(pictureChecksWorkflow, [{ assetIds: [asset.id] }]);
    await expect(later.returnValue).resolves.toStrictEqual({ passed: 1, removed: 0, replaced: 0 });

    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } }),
    ).resolves.toMatchObject({ checkFailures: 1, checkOwedAt: null });
  });

  it("checks no picture that owes no check or whose checks kept failing", async () => {
    const [checked, failing] = await Promise.all([
      mediaAssetFixture({ checkOwedAt: null, scene: sceneFor(`a map ${randomUUID()}`) }),
      mediaAssetFixture({
        checkFailures: 3,
        checkOwedAt: new Date(),
        scene: sceneFor(`a cell ${randomUUID()}`),
      }),
    ]);

    const run = await start(pictureChecksWorkflow, [{ assetIds: [checked.id, failing.id] }]);

    await expect(run.returnValue).resolves.toStrictEqual({ passed: 0, removed: 0, replaced: 0 });
    expect(checkLessonImage).not.toHaveBeenCalled();
  });
});
