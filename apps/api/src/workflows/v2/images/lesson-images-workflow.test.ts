import { randomUUID } from "node:crypto";
import { checkLessonImage } from "@zoonk/ai/tasks/v2/images/check";
import { generateLessonImage } from "@zoonk/ai/tasks/v2/images/generate";
import { generateImageScene } from "@zoonk/ai/tasks/v2/images/scene";
import { describeImageScene } from "@zoonk/ai/tasks/v2/images/scene-schema";
import { uploadImage } from "@zoonk/core/images/upload";
import { prisma } from "@zoonk/db";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { buildImageReuseKey } from "@zoonk/utils/identity-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_IMAGE, imageProvenance, passedCheck, sceneFor } from "./_test-utils/image-results";
import { PRIVATE_MAX_IMAGES, lessonImagesWorkflow } from "./lesson-images-workflow";

/**
 * Models and Vercel Blob are the external boundaries. Identity search, the
 * blank-frame check, asset rows and links run for real.
 */
vi.mock("@zoonk/ai/tasks/v2/images/check", () => ({ checkLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/generate", () => ({ generateLessonImage: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/images/scene", () => ({ generateImageScene: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({
  generateSearchTerms: vi.fn(async ({ subjects }: { subjects: unknown[] }) => ({
    data: { subjects: subjects.map(() => ({ terms: [] })) },
  })),
}));

vi.mock("@zoonk/core/images/upload", () => ({ uploadImage: vi.fn() }));

function explanation(prompt: string) {
  return { image: { alt: "A picture", prompt }, text: "One idea on this screen." };
}

/** Screens that each ask for a picture, two screens apart so every one of them gets drawn. */
function markedScreens({ lessonId, prompts }: { lessonId: string; prompts: string[] }) {
  return Promise.all(
    prompts.map((prompt, index) =>
      libraryStepFixture({ content: explanation(prompt), lessonId, position: index * 2 }),
    ),
  );
}

function lessonPictures(lessonId: string) {
  return prisma.step.findMany({
    orderBy: { position: "asc" },
    select: { mediaAssetId: true },
    where: { lessonId },
  });
}

describe(lessonImagesWorkflow, () => {
  beforeEach(() => {
    vi.mocked(generateImageScene).mockImplementation(({ request }) =>
      Promise.resolve({ data: sceneFor(request) } as never),
    );

    vi.mocked(generateLessonImage).mockResolvedValue({
      data: { image: { mediaType: "image/webp", uint8Array: TEST_IMAGE } },
      prompt: "test prompt",
      provenance: imageProvenance,
    } as never);

    vi.mocked(checkLessonImage).mockResolvedValue(passedCheck as never);

    vi.mocked(uploadImage).mockImplementation(({ fileName }) =>
      Promise.resolve({ data: `https://blob.test/${fileName}-${randomUUID()}`, error: null }),
    );
  });

  it("reuses a picture of the same scene and draws the rest", async () => {
    const [reusedPrompt, drawnPrompt] = [`scale ${randomUUID()}`, `coin ${randomUUID()}`];
    const reusedScene = sceneFor(reusedPrompt);

    const [lesson, existing] = await Promise.all([
      libraryLessonFixture(),
      mediaAssetFixture({
        prompt: describeImageScene(reusedScene),
        reuseKey: buildImageReuseKey({
          language: null,
          prompt: describeImageScene(reusedScene),
          styleVersion: 1,
        }),
        styleVersion: 1,
      }),
    ]);

    const [reusedStep, drawnStep] = await Promise.all([
      libraryStepFixture({ content: explanation(reusedPrompt), lessonId: lesson.id, position: 0 }),
      libraryStepFixture({ content: explanation(drawnPrompt), lessonId: lesson.id, position: 2 }),
    ]);

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 1,
      reused: 1,
    });

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { id: { in: [reusedStep.id, drawnStep.id] } },
    });

    expect(steps[0]?.mediaAssetId).toBe(existing.id);
    expect(steps[1]?.mediaAssetId).toStrictEqual(expect.any(String));
    expect(generateLessonImage).toHaveBeenCalledOnce();

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 0,
      reused: 0,
    });
  });

  it("draws only the first marked screen of a lesson made for one learner", async () => {
    const lesson = await libraryLessonFixture();
    const prompts = ["atom", "cell", "orbit"].map((name) => `${name} ${randomUUID()}`);
    await markedScreens({ lessonId: lesson.id, prompts });

    await expect(
      lessonImagesWorkflow({ lessonId: lesson.id, maxImages: PRIVATE_MAX_IMAGES }),
    ).resolves.toStrictEqual({ failed: 0, generated: 1, reused: 0 });

    const pictures = await lessonPictures(lesson.id);

    expect(pictures.map((step) => step.mediaAssetId !== null)).toStrictEqual([true, false, false]);
    expect(generateLessonImage).toHaveBeenCalledOnce();
  });

  it("draws the other screens when one screen's picture fails, and the next run draws only that one", async () => {
    const lesson = await libraryLessonFixture();
    const [failingPrompt, drawnPrompt] = [`prism ${randomUUID()}`, `lens ${randomUUID()}`];
    await markedScreens({ lessonId: lesson.id, prompts: [failingPrompt, drawnPrompt] });

    vi.mocked(generateImageScene).mockImplementation(({ request }) =>
      request === failingPrompt
        ? Promise.reject(new Error("Provider unavailable"))
        : Promise.resolve({ data: sceneFor(request) } as never),
    );

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 1,
      generated: 1,
      reused: 0,
    });

    const [failed, drawn] = await lessonPictures(lesson.id);

    expect(failed?.mediaAssetId).toBeNull();
    expect(drawn?.mediaAssetId).toStrictEqual(expect.any(String));

    vi.mocked(generateImageScene).mockImplementation(({ request }) =>
      Promise.resolve({ data: sceneFor(request) } as never),
    );

    vi.mocked(generateLessonImage).mockClear();

    await expect(lessonImagesWorkflow({ lessonId: lesson.id })).resolves.toStrictEqual({
      failed: 0,
      generated: 1,
      reused: 0,
    });

    expect(generateLessonImage).toHaveBeenCalledOnce();

    await expect(lessonPictures(lesson.id)).resolves.toStrictEqual([
      { mediaAssetId: expect.any(String) },
      drawn,
    ]);
  });
});
