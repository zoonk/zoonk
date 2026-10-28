import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { describeImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { IMAGE_STYLE_VERSION } from "@zoonk/ai/tasks/v2/images/style";
import { prisma } from "@zoonk/db";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { courseCategoryFixture, courseFixture } from "@zoonk/testing/fixtures/courses";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  numberedCheckContent,
  pictureCheckContent,
} from "@zoonk/testing/fixtures/playable-step-contents";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { buildImageReuseKey, scopeIdentityKey } from "@zoonk/utils/identity-key";
import { revalidateTag } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { storeBlobUploads } from "../../_test-utils/blob-uploads";
import { getLibraryLessonCacheTag } from "../../cache/tags";
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
import {
  createStepImage,
  createStepOptionPicture,
  listLessonImageSteps,
  listLessonOptionPictures,
} from "./lesson-images";

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

    const check = { basis: null, image, options, question: "Which caption fits the picture?" };

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

    storeBlobUploads();
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
        createdAt: new Date("2020-01-01T00:00:00Z"),
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
      pictureAvailableAt: expect.any(Date),
    });

    const linked = await prisma.step.findUniqueOrThrow({ where: { id: step.id } });
    expect(linked.pictureAvailableAt?.getTime()).toBeGreaterThan(existing.createdAt.getTime());
    await expect(createStepImage({ stepId: step.id })).resolves.toStrictEqual({ status: "none" });

    await expect(prisma.step.findUniqueOrThrow({ where: { id: step.id } })).resolves.toMatchObject({
      pictureAvailableAt: linked.pictureAvailableAt,
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
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "private-store-token");
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

    expect(put).toHaveBeenCalledWith(
      `images/${owner.id}/step.webp`,
      expect.any(Buffer),
      expect.objectContaining({ access: "private" }),
    );

    resetImageModels();
    const sceneSpy = mockImageScene(testScene({ focalObject: `a ${randomUUID()} house` }));
    mockSearchTerms([]);
    mockDrawnImages([await drawTestImage()]);

    await createStepImage({ stepId: languageStep.id });

    expect(sceneSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: "pt", textAllowed: false }),
    );

    expect(put).toHaveBeenLastCalledWith(
      "library/images/step.webp",
      expect.any(Buffer),
      expect.objectContaining({ access: "public" }),
    );

    vi.unstubAllEnvs();
  });

  it("draws no picture for a private lesson while the private store isn't set up", async () => {
    vi.stubEnv("PRIVATE_BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("PRIVATE_BLOB_STORE_ID", "");
    const owner = await userFixture();
    const lesson = await libraryLessonFixture({ ownerId: owner.id, visibility: "private" });

    const [step, question] = await Promise.all([
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 0 }),
      libraryStepFixture({
        content: pictureCheckContent,
        kind: "check",
        lessonId: lesson.id,
        position: 1,
      }),
    ]);

    const sceneSpy = mockImageScene(testScene({ focalObject: `our ${randomUUID()} notes` }));
    const drawSpy = mockDrawnImages([await drawTestImage()]);

    await expect(createStepImage({ stepId: step.id })).resolves.toStrictEqual({ status: "failed" });

    await expect(
      createStepOptionPicture({ optionId: "gothic", stepId: question.id }),
    ).resolves.toStrictEqual({ status: "failed" });

    expect(sceneSpy).not.toHaveBeenCalled();
    expect(drawSpy).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();

    await expect(prisma.step.findUnique({ where: { id: step.id } })).resolves.toMatchObject({
      mediaAssetId: null,
    });

    vi.unstubAllEnvs();
  });
});

describe("pictures questions are asked about", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    storeBlobUploads();
  });

  it("lists each picture option not drawn yet, in screen order", async () => {
    const [lesson, asset] = await Promise.all([libraryLessonFixture(), mediaAssetFixture()]);

    const [first, second] = await Promise.all([
      libraryStepFixture({
        content: pictureCheckContent,
        kind: "check",
        lessonId: lesson.id,
        position: 0,
      }),
      libraryStepFixture({
        content: pictureCheckContent,
        kind: "check",
        lessonId: lesson.id,
        position: 1,
      }),
      libraryStepFixture({ content: explanation(), lessonId: lesson.id, position: 2 }),
    ]);

    await prisma.stepOptionPicture.create({
      data: { mediaAssetId: asset.id, optionId: "gothic", stepId: first.id },
    });

    await expect(listLessonOptionPictures({ lessonId: lesson.id })).resolves.toStrictEqual([
      { optionId: "romanesque", stepId: first.id },
      { optionId: "baroque", stepId: first.id },
      { optionId: "gothic", stepId: second.id },
      { optionId: "romanesque", stepId: second.id },
      { optionId: "baroque", stepId: second.id },
    ]);
  });

  it("draws a picture option alone, without text or its name, and links it to its option", async () => {
    const lesson = await libraryLessonFixture();

    const step = await libraryStepFixture({
      content: pictureCheckContent,
      kind: "check",
      lessonId: lesson.id,
    });

    const sceneSpy = mockImageScene(testScene({ focalObject: `a ${randomUUID()} doorway` }));
    mockSearchTerms([]);
    mockDrawnImages([await drawTestImage()]);

    const outcome = await createStepOptionPicture({ optionId: "gothic", stepId: step.id });

    expect(outcome).toMatchObject({ status: "generated" });

    expect(sceneSpy).toHaveBeenCalledWith(
      expect.objectContaining({ screenText: pictureCheckContent.question, textAllowed: false }),
    );

    expect(JSON.stringify(sceneSpy.mock.calls)).not.toContain('"Gothic"');

    await expect(
      prisma.stepOptionPicture.findUniqueOrThrow({
        where: { stepId_optionId: { optionId: "gothic", stepId: step.id } },
      }),
    ).resolves.toMatchObject({
      mediaAssetId: outcome.status === "generated" && outcome.mediaAssetId,
    });

    expect(revalidateTag).toHaveBeenCalledWith(getLibraryLessonCacheTag(lesson.id), { expire: 0 });

    await expect(
      createStepOptionPicture({ optionId: "gothic", stepId: step.id }),
    ).resolves.toStrictEqual({ status: "none" });
  });

  it("numbers a question's picture from its parts, in order, and draws no words", async () => {
    const lesson = await libraryLessonFixture();

    const step = await libraryStepFixture({
      content: numberedCheckContent,
      kind: "check",
      lessonId: lesson.id,
    });

    const sceneSpy = mockImageScene(
      testScene({
        focalObject: `a ${randomUUID()} flower cut in half`,
        labels: [{ target: "the ovary", text: "ovary" }],
      }),
    );

    mockSearchTerms([]);
    mockDrawnImages([await drawTestImage()]);

    await expect(createStepImage({ stepId: step.id })).resolves.toMatchObject({
      status: "generated",
    });

    expect(sceneSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.stringContaining("Show each of these parts clearly: petal; stigma; ovary."),
        textAllowed: false,
      }),
    );

    const linked = await prisma.step.findUniqueOrThrow({
      include: { mediaAsset: true },
      where: { id: step.id },
    });

    expect(linked.mediaAsset?.scene).toMatchObject({
      labels: [
        { target: "pointing at the petal", text: "1" },
        { target: "pointing at the stigma", text: "2" },
        { target: "pointing at the ovary", text: "3" },
      ],
    });

    expect(linked.mediaAsset?.language).toBeNull();
  });
});
