import { randomUUID } from "node:crypto";
import { describeImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { prisma } from "@zoonk/db";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildImageReuseKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLibraryLessonCacheTag } from "../../cache/tags";
import { uploadImage } from "../../images/upload-image";
import { mockSearchTerms } from "../identity/_test-utils/identity-mocks";
import {
  TEST_IMAGE_HEIGHT,
  TEST_IMAGE_WIDTH,
  drawBlankImage,
  drawTestImage,
  mockDrawnImages,
  mockImageChecks,
  mockImageScene,
  resetImageModels,
  testScene,
} from "./_test-utils/image-mocks";
import { createStepImage, listLessonImageSteps } from "./lesson-images";

/** Vercel Blob is an external service; the stored URL is all these tests need from it. */
vi.mock("../../images/upload-image", () => ({ uploadImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({ decideLibraryIdentity: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/check", () => ({ checkLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/generate", () => ({ generateLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/scene", () => ({ generateImageScene: vi.fn() }));

const image = { alt: "A price tag before and after a discount", prompt: "A discounted price tag" };

function explanation(withImage = true) {
  return { text: "You pay 75% of the old price.", title: "Discounts", ...(withImage && { image }) };
}

async function scienceLesson(attrs?: Parameters<typeof libraryLessonFixture>[0]) {
  const course = await courseFixture({ title: "Physics" });

  const [chapter] = await Promise.all([
    libraryChapterFixture({ homeCourseId: course.id, title: "Atoms" }),
    courseCategoryFixture({ category: "science", courseId: course.id }),
  ]);

  return libraryLessonFixture({ homeChapterId: chapter.id, title: "Electrons", ...attrs });
}

function stepKey(scene: ReturnType<typeof testScene>) {
  return buildImageReuseKey({
    language: scene.labels.length > 0 ? "en" : null,
    prompt: describeImageScene(scene),
    styleVersion: 1,
  });
}

describe(listLessonImageSteps, () => {
  it("lists requested pictures at most one every two screens, skipping drawn ones", async () => {
    const [lesson, asset] = await Promise.all([libraryLessonFixture(), mediaAssetFixture()]);
    const hook = { image, text: "A shop cuts a price.", variant: "text" };

    const steps = await Promise.all([
      libraryStepFixture({ content: hook, kind: "hook", lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 1 }),
      libraryStepFixture({ content: explanation(false), lessonId: lesson.id, position: 2 }),
      libraryStepFixture({
        content: { image, text: "Not a contract" },
        kind: "summary",
        lessonId: lesson.id,
        position: 3,
      }),
      libraryStepFixture({
        content: explanation(),
        lessonId: lesson.id,
        mediaAssetId: asset.id,
        position: 4,
      }),
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 5 }),
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 6 }),
    ]);

    await expect(listLessonImageSteps({ lessonId: lesson.id })).resolves.toStrictEqual([
      steps[0]?.id,
      steps[6]?.id,
    ]);
  });
});

describe("activity pictures", () => {
  it("lists the picture a decision tree's case asks for", async () => {
    const lesson = await libraryLessonFixture();
    const leaf = { alt: "A leaf with toothed edges and veins in pairs", prompt: "A beech leaf" };

    const step = await libraryStepFixture({
      content: { ...activityContentFixtures.decisionTree, image: leaf },
      kind: "activity",
      lessonId: lesson.id,
      position: 0,
    });

    await expect(listLessonImageSteps({ lessonId: lesson.id })).resolves.toStrictEqual([step.id]);
  });
});

describe(createStepImage, () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
      Promise.resolve({ data: `https://blob.test/${fileName}-${randomUUID()}`, error: null }),
    );
  });

  it("draws, checks and stores a new picture in the subject's palette", async () => {
    const lesson = await scienceLesson();
    const step = await libraryStepFixture({ content: explanation(), lessonId: lesson.id });

    const scene = testScene({
      focalObject: `a ${randomUUID()} tag`,
      labels: [{ target: "the tag", text: "$60" }],
    });

    mockImageScene(scene);
    mockSearchTerms([]);
    const drawSpy = mockDrawnImages([await drawTestImage()]);
    mockImageChecks([true]);

    const outcome = await createStepImage({ stepId: step.id });

    expect(outcome).toMatchObject({ status: "generated" });

    const linked = await prisma.step.findUniqueOrThrow({
      include: { mediaAsset: true },
      where: { id: step.id },
    });

    expect(linked.mediaAsset).toMatchObject({
      height: TEST_IMAGE_HEIGHT,
      kind: "image",
      language: "en",
      model: "openai/gpt-image-2.5-flare",
      palette: "science",
      prompt: describeImageScene(scene),
      reuseKey: stepKey(scene),
      scene,
      styleVersion: 1,
      visibility: "public",
      width: TEST_IMAGE_WIDTH,
    });

    expect(revalidateTag).toHaveBeenCalledWith(getLibraryLessonCacheTag(lesson.id), { expire: 0 });
    await expect(createStepImage({ stepId: step.id })).resolves.toStrictEqual({ status: "none" });

    expect(drawSpy).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ palette: expect.objectContaining({ key: "science" }) }),
    );
  });

  it("reuses an image of the same scene without drawing", async () => {
    const lesson = await libraryLessonFixture();
    const scene = testScene({ focalObject: `a ${randomUUID()} scale` });

    const [step, existing] = await Promise.all([
      libraryStepFixture({ content: explanation(), lessonId: lesson.id }),
      mediaAssetFixture({
        prompt: describeImageScene(scene),
        reuseKey: stepKey(scene),
        styleVersion: 1,
      }),
    ]);

    mockImageScene(scene);
    const drawSpy = mockDrawnImages([]);

    await expect(createStepImage({ stepId: step.id })).resolves.toStrictEqual({
      mediaAssetId: existing.id,
      status: "reused",
    });

    expect(drawSpy).not.toHaveBeenCalled();

    await expect(prisma.step.findUnique({ where: { id: step.id } })).resolves.toMatchObject({
      mediaAssetId: existing.id,
    });
  });

  it("tries once more after a failed image and ships the screen without one after two", async () => {
    const lesson = await libraryLessonFixture();

    const [retried, abandoned] = await Promise.all([
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 2 }),
    ]);

    mockSearchTerms([]);
    mockImageScene(testScene({ focalObject: `a ${randomUUID()} coin` }));
    const drawSpy = mockDrawnImages([await drawBlankImage(), await drawTestImage()]);
    const checkSpy = mockImageChecks([true]);

    await expect(createStepImage({ stepId: retried.id })).resolves.toMatchObject({
      status: "generated",
    });

    expect(drawSpy).toHaveBeenCalledTimes(2);
    expect(checkSpy).toHaveBeenCalledOnce();

    expect(drawSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ corrections: ["the image was a blank frame"] }),
    );

    resetImageModels();
    mockSearchTerms([]);
    mockImageScene(testScene({ focalObject: `a ${randomUUID()} bill` }));
    mockDrawnImages([await drawTestImage(), await drawTestImage()]);
    mockImageChecks([false, false]);

    await expect(createStepImage({ stepId: abandoned.id })).resolves.toStrictEqual({
      status: "failed",
    });

    await expect(prisma.step.findUnique({ where: { id: abandoned.id } })).resolves.toMatchObject({
      mediaAssetId: null,
    });
  });

  it("keeps a private lesson's picture private and language courses free of text", async () => {
    const owner = await userFixture();

    const [privateLesson, languageLesson] = await Promise.all([
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
      libraryLessonFixture({ language: "pt", targetLanguage: "es" }),
    ]);

    const [privateStep, languageStep] = await Promise.all([
      libraryStepFixture({ content: explanation(), lessonId: privateLesson.id }),
      libraryStepFixture({ content: explanation(), lessonId: languageLesson.id }),
    ]);

    const privateScene = testScene({ focalObject: `our ${randomUUID()} form` });
    mockImageScene(privateScene);
    mockDrawnImages([await drawTestImage()]);
    mockImageChecks([true]);

    await createStepImage({ stepId: privateStep.id });

    const linked = await prisma.step.findUniqueOrThrow({
      include: { mediaAsset: true },
      where: { id: privateStep.id },
    });

    expect(linked.mediaAsset).toMatchObject({
      ownerId: owner.id,
      reuseKey: scopeIdentityKey({ key: stepKey(privateScene), ownerId: owner.id }),
      visibility: "private",
    });

    // The file goes to the owner's folder in the private store, which account deletion empties.
    expect(uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({ access: "private", fileName: `images/${owner.id}/step.webp` }),
    );

    resetImageModels();
    const sceneSpy = mockImageScene(testScene({ focalObject: `a ${randomUUID()} house` }));
    mockSearchTerms([]);
    mockDrawnImages([await drawTestImage()]);
    mockImageChecks([true]);

    await createStepImage({ stepId: languageStep.id });

    expect(sceneSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: "pt", textAllowed: false }),
    );

    // A shared picture goes to the public store, which the CDN serves to everyone.
    expect(uploadImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ access: "public", fileName: "library/images/step.webp" }),
    );
  });
});
