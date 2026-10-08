import { randomUUID } from "node:crypto";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { describeImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { IMAGE_STYLE_VERSION } from "@zoonk/ai/tasks/v2/images/style";
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
    styleVersion: IMAGE_STYLE_VERSION,
  });
}

describe(listLessonImageSteps, () => {
  it("lists every picture a screen still asks for, skipping drawn ones", async () => {
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
      steps[1]?.id,
      steps[5]?.id,
      steps[6]?.id,
    ]);
  });

  it("lists the pictures questions are about and those that teach alike, in screen order", async () => {
    const lesson = await libraryLessonFixture({ language: "pt" });

    const options = [
      { id: "a", isCorrect: true, reason: "You see him standing.", text: "Otávio stands" },
      { id: "b", isCorrect: false, reason: "He isn't riding.", text: "Otávio rides" },
    ];

    const guess = {
      image,
      options: options.map(({ id, isCorrect, text }) => ({ id, isCorrect, text })),
      question: "Which caption fits?",
      reveal: "He stands.",
      variant: "guess",
    };

    const check = { image, options, question: "Which caption fits the picture?" };

    const steps = await Promise.all([
      libraryStepFixture({ content: guess, kind: "hook", lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 1 }),
      libraryStepFixture({ content: check, kind: "check", lessonId: lesson.id, position: 2 }),
      libraryStepFixture({ content: check, kind: "check", lessonId: lesson.id, position: 3 }),
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 4 }),
      libraryStepFixture({
        content: { image, text: "Na placa da imagem, o Centro fica em frente.", title: "Setas" },
        lessonId: lesson.id,
        position: 5,
      }),
    ]);

    await expect(listLessonImageSteps({ lessonId: lesson.id })).resolves.toStrictEqual(
      steps.map((step) => step.id),
    );
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

  it("draws and stores a new picture in the subject's palette, showing it before its model check", async () => {
    const lesson = await scienceLesson();
    const step = await libraryStepFixture({ content: explanation(), lessonId: lesson.id });

    const scene = testScene({
      focalObject: `a ${randomUUID()} tag`,
      labels: [{ target: "the tag", text: "$60" }],
    });

    mockImageScene(scene);
    mockSearchTerms([]);
    const drawSpy = mockDrawnImages([await drawTestImage()]);

    const outcome = await createStepImage({ stepId: step.id });

    expect(outcome).toMatchObject({ status: "generated" });

    // The model check follows in the background (`checkImageAsset`).
    expect(checkLessonImage).not.toHaveBeenCalled();

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
      styleVersion: IMAGE_STYLE_VERSION,
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
        styleVersion: IMAGE_STYLE_VERSION,
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

  it("draws a blank frame once more and ships the screen without a picture after two", async () => {
    const lesson = await libraryLessonFixture();

    const [retried, abandoned] = await Promise.all([
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 2 }),
    ]);

    mockSearchTerms([]);
    mockImageScene(testScene({ focalObject: `a ${randomUUID()} coin` }));
    const drawSpy = mockDrawnImages([await drawBlankImage(), await drawTestImage()]);

    await expect(createStepImage({ stepId: retried.id })).resolves.toMatchObject({
      status: "generated",
    });

    expect(drawSpy).toHaveBeenCalledTimes(2);

    expect(drawSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ corrections: ["the image was a blank frame"] }),
    );

    resetImageModels();
    mockSearchTerms([]);
    mockImageScene(testScene({ focalObject: `a ${randomUUID()} bill` }));
    mockDrawnImages([await drawBlankImage(), await drawBlankImage()]);

    await expect(createStepImage({ stepId: abandoned.id })).resolves.toStrictEqual({
      status: "failed",
    });

    await expect(prisma.step.findUnique({ where: { id: abandoned.id } })).resolves.toMatchObject({
      mediaAssetId: null,
    });

    expect(checkLessonImage).not.toHaveBeenCalled();
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
